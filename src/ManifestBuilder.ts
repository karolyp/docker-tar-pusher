import { Config, Layer, RegistryManifest } from './types';

export const MANIFEST_MEDIA_TYPE = 'application/vnd.docker.distribution.manifest.v2+json';

export default class ManifestBuilder {
  private layers?: Layer[];
  private config?: Config;

  public buildManifest(): RegistryManifest {
    if (!this.config || !this.layers) {
      throw new Error('Manifest config or layers are not set');
    }
    return {
      config: this.config,
      layers: this.layers,
      schemaVersion: 2,
      mediaType: MANIFEST_MEDIA_TYPE
    };
  }

  public addLayer(digest: string, size: number): void {
    if (!this.layers) {
      this.layers = [];
    }
    this.layers.push({
      digest,
      size,
      mediaType: 'application/vnd.docker.image.rootfs.diff.tar'
    });
  }

  public setConfig(digest: string, size: number): void {
    this.config = {
      digest,
      size,
      mediaType: 'application/vnd.docker.container.image.v1+json'
    };
  }
}
