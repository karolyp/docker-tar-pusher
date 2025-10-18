import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { AxiosInstance } from 'axios';
import RegistryError from '../errors/RegistryError';
import UploadError from '../errors/UploadError';
import type { ApplicationConfiguration, ChunkMetaData, Headers } from '../types';
import { ContentTypes, RequestHeaders } from '../types';
import type ManifestBuilder from './ManifestBuilder';

export default class DockerRegistryService {
  constructor(
    private readonly config: ApplicationConfiguration,
    private readonly axios: AxiosInstance,
    private readonly manifestBuilder: ManifestBuilder
  ) {}

  public async uploadLayer(cwd: string, image: string, layerFile: string): Promise<void> {
    const uploadUrl = await this.initiateUpload(image);
    const chunkMetaData = await this.pushFileInChunks(cwd, uploadUrl, layerFile);
    this.manifestBuilder.addLayer(chunkMetaData);
  }

  public async uploadConfig(cwd: string, image: string, configFile: string): Promise<void> {
    const uploadUrl = await this.initiateUpload(image);
    const chunkMetaData = await this.pushFileInChunks(cwd, uploadUrl, configFile);
    this.manifestBuilder.setConfig(chunkMetaData);
  }

  public async pushManifest(image: string, tag: string): Promise<void> {
    const headers = {
      [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_MANIFEST
    };
    const url = `${this.config.registryUrl}/v2/${image}/manifests/${tag}`;
    try {
      await this.axios.put(url, this.manifestBuilder.buildManifest(), { headers });
    } catch (e) {
      const statusCode = e instanceof Error && 'response' in e ? (e as any).response?.status : undefined;
      throw new RegistryError(`Failed to push manifest for ${image}:${tag}`, statusCode, {
        url,
        image,
        tag,
        operation: 'push_manifest'
      });
    }
  }

  private async pushFileInChunks(cwd: string, uploadUrl: string, file: string): Promise<ChunkMetaData> {
    const sha256 = createHash('sha256');
    let bytesRead = 0;
    let followUploadUrl = uploadUrl;
    let chunk;
    let headers;

    const { size: fileSize } = await stat(join(cwd, file));

    try {
      const readStream = createReadStream(join(cwd, file), {
        highWaterMark: this.config.chunkSize
      });
      for await (chunk of readStream) {
        headers = this.getChunkUploadHeaders(bytesRead, chunk.length);
        bytesRead += chunk.length;
        sha256.update(chunk);
        if (bytesRead < fileSize) {
          const { headers: responseHeaders } = await this.axios.patch(followUploadUrl, chunk, { headers });
          followUploadUrl = responseHeaders['location'] || ''; // FIXME: quickfix for axios' breaking API change
        }
      }
      // last chunk
      const digest = `sha256:${sha256.digest('hex')}`;
      await this.axios.put(`${followUploadUrl}&digest=${digest}`, chunk, { headers });
      return {
        digest,
        size: bytesRead
      };
    } catch (e) {
      throw new UploadError(`Failed to upload file: ${file}`, {
        fileName: file,
        uploadUrl,
        bytesUploaded: bytesRead,
        totalBytes: fileSize,
        operation: 'chunk'
      });
    }
  }

  private getChunkUploadHeaders = (start: number, length: number): Headers => ({
    [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_OCTET_STREAM,
    [RequestHeaders.CONTENT_LENGTH]: String(length),
    [RequestHeaders.CONTENT_RANGE]: `${start}-${start + length}`
  });

  private async initiateUpload(image: string): Promise<string> {
    const startUploadUrl = `${this.config.registryUrl}/v2/${image}/blobs/uploads/`;
    try {
      const { headers } = await this.axios.post(startUploadUrl);
      return headers['location'] || ''; // FIXME: quickfix for axios' breaking API change
    } catch (e) {
      const statusCode = e instanceof Error && 'response' in e ? (e as any).response?.status : undefined;
      throw new RegistryError(`Failed to initiate upload for image: ${image}`, statusCode, {
        url: startUploadUrl,
        image,
        operation: 'initiate_upload'
      });
    }
  }
}
