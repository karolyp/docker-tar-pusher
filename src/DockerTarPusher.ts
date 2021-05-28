import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { DockerTarPusherOptions, MetaData } from './types';
import ManifestBuilder, { MANIFEST_MEDIA_TYPE } from './ManifestBuilder';
import Utils from './Utils';

const CHUNK_SIZE = 10 * 1024 * 1024;
export default class DockerTarPusher {
  private readonly utils: Utils;
  private readonly axios: AxiosInstance;
  private readonly manifestBuilder: ManifestBuilder;

  constructor(private options: DockerTarPusherOptions) {
    this.utils = new Utils();
    this.manifestBuilder = new ManifestBuilder();
    this.axios = axios.create({
      maxBodyLength: CHUNK_SIZE,
      maxContentLength: CHUNK_SIZE
    });
  }

  public async pushToRegistry(): Promise<void> {
    try {
      this.utils.extract(this.options.tarball);
      const manifest = this.utils.readManifest();

      for (const repoTag of manifest.RepoTags) {
        const [image, tag] = repoTag.split(':');
        console.log(`Pushing ${image}:${tag}...`);
        for await (const layer of manifest.Layers) {
          console.log(`Pushing layer ${layer.split('/')[0]}...`);
          try {
            await this.handleLayer(image, layer);
          } catch (e) {
            console.log(e.message);
          }
        }

        console.log('Pushing config...');
        await this.handleConfig(image, manifest.Config);

        console.log('Pushing manifest...');
        await this.pushManifest(image, tag);
      }
    } finally {
      this.utils.cleanUp();
    }
  }

  private async startUpload(image: string): Promise<string> {
    const url = `${this.options.registryUrl}/v2/${image}/blobs/uploads/`;
    return (await axios.post(url)).headers.location;
  }

  private async handleLayer(image: string, layerFile: string) {
    const uploadUrl = await this.startUpload(image);
    const { digest, size } = await this.pushChunks(uploadUrl, layerFile);
    this.addLayerDataToManifest(digest, size);
  }

  private async handleConfig(image: string, configFile: string) {
    const uploadUrl = await this.startUpload(image);
    const { digest, size } = await this.pushChunks(uploadUrl, configFile);
    this.addConfigDataToManifest(digest, size);
  }

  private async pushChunks(uploadUrl: string, file: string): Promise<MetaData> {
    const sha256 = crypto.createHash('sha256');
    let offset = 0;
    let followUploadUrl = uploadUrl;
    let chunk;
    let headers;

    for await (chunk of this.utils.readChunks(file, CHUNK_SIZE)) {
      headers = this.utils.getUploadHeaders(offset, chunk.length);
      offset += chunk.length;
      sha256.update(chunk);
      if (chunk.length === CHUNK_SIZE) {
        const { headers: responseHeaders } = await this.axios.patch(followUploadUrl, chunk, { headers });
        followUploadUrl = responseHeaders['location'];
      }
    }
    // last chunk
    const digest = `sha256:${sha256.digest('hex')}`;
    await this.axios.put(`${followUploadUrl}&digest=${digest}`, chunk, { headers });
    return {
      digest,
      size: offset
    };
  }

  private addLayerDataToManifest(digest: string, size: number): void {
    this.manifestBuilder.addLayer(digest, size);
  }

  private addConfigDataToManifest(digest: string, size: number): void {
    this.manifestBuilder.setConfig(digest, size);
  }

  private async pushManifest(image: string, tag: string): Promise<void> {
    const headers = {
      'Content-Type': MANIFEST_MEDIA_TYPE
    };
    const url = `${this.options.registryUrl}/v2/${image}/manifests/${tag}`;
    await axios.put(url, this.manifestBuilder.buildManifest(), { headers });
  }
}
