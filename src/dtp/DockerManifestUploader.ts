import type { AxiosInstance } from 'axios';
import DockerTarPusherError from '../errors/DockerTarPusherError';
import type { ApplicationConfiguration } from '../types';
import { ContentTypes, RequestHeaders } from '../types';
import type ManifestBuilder from './ManifestBuilder';

export default class DockerManifestUploader {
  constructor(
    private readonly config: ApplicationConfiguration,
    private readonly axios: AxiosInstance,
    private readonly manifestBuilder: ManifestBuilder
  ) {}

  public async pushManifest(image: string, tag: string): Promise<void> {
    const headers = {
      [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_MANIFEST
    };
    const url = `${this.config.registryUrl}/v2/${image}/manifests/${tag}`;
    try {
      await this.axios.put(url, this.manifestBuilder.buildManifest(), { headers });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      throw new DockerTarPusherError(`Error during pushing manifest. Message: ${message}`, {
        url,
        image,
        tag
      });
    }
  }
}
