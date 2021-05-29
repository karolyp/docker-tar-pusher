import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { ContentTypes, DockerTarPusherOptions, MetaData, RequestHeaders, ApplicationConfiguration } from './types';
import ManifestBuilder from './ManifestBuilder';
import Utils from './Utils';
import Logger from './Logger';
import { getConfiguration } from './config';
import { createInstance } from './axios';

export default class DockerTarPusher {
  private readonly utils: Utils;
  private readonly axios: AxiosInstance;
  private readonly manifestBuilder: ManifestBuilder;
  private readonly config: ApplicationConfiguration;
  private readonly logger: Logger;

  constructor(options: DockerTarPusherOptions) {
    this.config = getConfiguration(options);
    this.logger = new Logger({ quiet: this.config.quiet });
    this.logger.log(`App starting with config: ${JSON.stringify(this.config)}`);
    this.utils = new Utils();
    this.manifestBuilder = new ManifestBuilder();
    this.axios = createInstance(this.config);
  }

  public async pushToRegistry(): Promise<void> {
    try {
      this.utils.extract(this.config.tarball);
      const manifest = this.utils.readManifest();

      for (const repoTag of manifest.RepoTags) {
        const [image, tag] = repoTag.split(':');
        this.logger.log(`Pushing ${image}:${tag}...`);
        for await (const layer of manifest.Layers) {
          this.logger.log(`Pushing layer ${layer.split('/')[0]}...`);
          await this.handleLayer(image, layer);
        }

        this.logger.log('Pushing config...');
        await this.handleConfig(image, manifest.Config);

        this.logger.log('Pushing manifest...');
        await this.pushManifest(image, tag);
      }
    } finally {
      this.utils.cleanUp();
    }
  }

  private async startUpload(image: string): Promise<string> {
    const startUploadUrl = `${this.config.registryUrl}/v2/${image}/blobs/uploads/`;
    try {
      return (await axios.post(startUploadUrl)).headers.location;
    } catch ({ message }) {
      throw new Error(`Error during initiating upload. Message: ${message}`);
    }
  }

  private async handleLayer(image: string, layerFile: string) {
    const uploadUrl = await this.startUpload(image);
    const { digest, size } = await this.pushFileInChunks(uploadUrl, layerFile);
    this.addLayerDataToManifest(digest, size);
  }

  private async handleConfig(image: string, configFile: string) {
    const uploadUrl = await this.startUpload(image);
    const { digest, size } = await this.pushFileInChunks(uploadUrl, configFile);
    this.addConfigDataToManifest(digest, size);
  }

  private async pushFileInChunks(uploadUrl: string, file: string): Promise<MetaData> {
    const sha256 = crypto.createHash('sha256');
    let offset = 0;
    let followUploadUrl = uploadUrl;
    let chunk;
    let headers;

    try {
      for await (chunk of this.utils.readChunks(file, this.config.chunkSize)) {
        headers = this.utils.getUploadHeaders(offset, chunk.length);
        offset += chunk.length;
        sha256.update(chunk);
        if (chunk.length === this.config.chunkSize) {
          const { headers: responseHeaders } = await this.axios.patch(followUploadUrl, chunk, { headers });
          followUploadUrl = responseHeaders.location;
        }
      }
      // last chunk
      const digest = `sha256:${sha256.digest('hex')}`;
      await this.axios.put(`${followUploadUrl}&digest=${digest}`, chunk, { headers });
      return {
        digest,
        size: offset
      };
    } catch ({ message }) {
      throw new Error(`Error during pushing file. Message: ${message}`);
    }
  }

  private addLayerDataToManifest(digest: string, size: number): void {
    this.manifestBuilder.addLayer(digest, size);
  }

  private addConfigDataToManifest(digest: string, size: number): void {
    this.manifestBuilder.setConfig(digest, size);
  }

  private async pushManifest(image: string, tag: string): Promise<void> {
    const headers = {
      [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_MANIFEST
    };
    const url = `${this.config.registryUrl}/v2/${image}/manifests/${tag}`;
    try {
      await axios.put(url, this.manifestBuilder.buildManifest(), { headers });
    } catch ({ message }) {
      throw new Error(`Error during pushing manifest. Message: ${message}`);
    }
  }
}
