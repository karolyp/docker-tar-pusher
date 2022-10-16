import { ApplicationConfiguration, ContentTypes, ChunkMetaData, Headers, RequestHeaders } from '../types';
import crypto from 'crypto';
import DockerTarPusherError from '../errors/DockerTarPusherError';
import WorkDirUtils from '../utils/WorkDirUtils';
import { AxiosInstance } from 'axios';
import ManifestBuilder from './ManifestBuilder';

export default class DockerImageUploader {
  constructor(
    private readonly workDirUtils: WorkDirUtils,
    private readonly config: ApplicationConfiguration,
    private readonly axios: AxiosInstance,
    private readonly manifestBuilder: ManifestBuilder
  ) {}

  private async pushFileInChunks(uploadUrl: string, file: string): Promise<ChunkMetaData> {
    const sha256 = crypto.createHash('sha256');
    let bytesRead = 0;
    let followUploadUrl = uploadUrl;
    let chunk;
    let headers;
    const fileSize = await this.workDirUtils.getFileSize(file);

    try {
      for await (chunk of this.workDirUtils.readChunks(file, this.config.chunkSize)) {
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
    } catch ({ message }) {
      throw new DockerTarPusherError(`${file} Error during pushing file. Message: ${message}`, {
        uploadUrl,
        fileName: file
      });
    }
  }

  private getChunkUploadHeaders = (start: number, length: number): Headers => ({
    [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_OCTET_STREAM,
    [RequestHeaders.CONTENT_LENGTH]: String(length),
    [RequestHeaders.CONTENT_RANGE]: `${start}-${start + length}`
  });

  public async handleLayer(image: string, layerFile: string): Promise<void> {
    const uploadUrl = await this.initiateUpload(image);
    const chunkMetaData = await this.pushFileInChunks(uploadUrl, layerFile);
    this.manifestBuilder.addLayer(chunkMetaData);
  }

  public async handleConfig(image: string, configFile: string): Promise<void> {
    const uploadUrl = await this.initiateUpload(image);
    const chunkMetaData = await this.pushFileInChunks(uploadUrl, configFile);
    this.manifestBuilder.setConfig(chunkMetaData);
  }

  private async initiateUpload(image: string): Promise<string> {
    const startUploadUrl = `${this.config.registryUrl}/v2/${image}/blobs/uploads/`;
    try {
      const { headers } = await this.axios.post(startUploadUrl);
      return headers['location'] || ''; // FIXME: quickfix for axios' breaking API change
    } catch ({ message }) {
      throw new DockerTarPusherError(`Error during initiating upload. Message: ${message}`, { image });
    }
  }
}
