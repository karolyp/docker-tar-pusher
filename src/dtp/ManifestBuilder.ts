import ManifestError from '../errors/ManifestError';
import type { ChunkMetaData, Config, Layer, RegistryManifest } from '../types';
import { ContentTypes } from '../types';

export default class ManifestBuilder {
  private layers?: Layer[];
  private config?: Config;

  public buildManifest(): RegistryManifest {
    if (!this.config || !this.layers) {
      throw new ManifestError('Cannot build manifest: config or layers are not set', {
        operation: 'build'
      });
    }
    return {
      config: this.config,
      layers: this.layers,
      schemaVersion: 2,
      mediaType: ContentTypes.APPLICATION_MANIFEST
    };
  }

  public addLayer({ digest, size }: ChunkMetaData): void {
    if (!this.layers) {
      this.layers = [];
    }
    this.layers.push({
      digest,
      size,
      mediaType: ContentTypes.APPLICATION_LAYER
    });
  }

  public setConfig({ digest, size }: ChunkMetaData): void {
    this.config = {
      digest,
      size,
      mediaType: ContentTypes.APPLICATION_CONFIG
    };
  }
}
