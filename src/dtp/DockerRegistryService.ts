import type { AxiosInstance } from 'axios';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import RegistryError from '../errors/RegistryError';
import UploadError from '../errors/UploadError';
import type { Auth, ChunkMetaData, Headers, RegistryManifest } from '../types';
import { ContentTypes, RequestHeaders } from '../types';
import { createInstance } from '../config/axios';

type DockerRegistryServiceConfig = {
  chunkSize: number;
  registryUrl: string;
  sslVerify: boolean;
  auth?: Auth;
};

export default class DockerRegistryService {
  private readonly axios: AxiosInstance;

  constructor(private readonly config: DockerRegistryServiceConfig) {
    this.axios = createInstance({
      chunkSize: this.config.chunkSize,
      sslVerify: this.config.sslVerify,
      auth: this.config.auth
    });
  }

  public async upload(cwd: string, image: string, file: string) {
    const uploadUrl = await this.initiateUpload(image);
    const chunkMetaData = await this.pushFileInChunks(cwd, uploadUrl, file);
    return chunkMetaData;
  }

  public async pushManifest(manifest: RegistryManifest, image: string, tag: string): Promise<void> {
    const headers = {
      [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_MANIFEST
    };
    const url = `${this.config.registryUrl}/v2/${image}/manifests/${tag}`;
    try {
      await this.axios.put(url, manifest, { headers });
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

  private getChunkUploadHeaders = (start: number, length: number): Headers => ({
    [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_OCTET_STREAM,
    [RequestHeaders.CONTENT_LENGTH]: String(length),
    [RequestHeaders.CONTENT_RANGE]: `${start}-${start + length}`
  });
}
