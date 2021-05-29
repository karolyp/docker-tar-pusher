import { Config, ContentTypes, Layer, RegistryManifest } from './types';

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
      mediaType: ContentTypes.APPLICATION_MANIFEST
    };
  }

  public addLayer(digest: string, size: number): void {
    if (!this.layers) {
      this.layers = [];
    }
    this.layers.push({
      digest,
      size,
      mediaType: ContentTypes.APPLICATION_LAYER
    });
  }

  public setConfig(digest: string, size: number): void {
    this.config = {
      digest,
      size,
      mediaType: ContentTypes.APPLICATION_CONFIG
    };
  }
}
