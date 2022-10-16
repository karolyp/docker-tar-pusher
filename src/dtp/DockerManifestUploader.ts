import { ApplicationConfiguration, ContentTypes, RequestHeaders } from '../types';
import { AxiosInstance } from 'axios';
import ManifestBuilder from './ManifestBuilder';
import DockerTarPusherError from '../errors/DockerTarPusherError';

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
    } catch ({ message }) {
      throw new DockerTarPusherError(`Error during pushing manifest. Message: ${message}`, {
        url,
        image,
        tag
      });
    }
  }
}
