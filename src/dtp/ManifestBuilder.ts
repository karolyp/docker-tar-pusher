import { ChunkMetaData, Config, ContentTypes, Layer, RegistryManifest } from '../types';
import DockerTarPusherError from '../errors/DockerTarPusherError';

export default class ManifestBuilder {
  private layers?: Layer[];
  private config?: Config;

  public buildManifest(): RegistryManifest {
    if (!this.config || !this.layers) throw new DockerTarPusherError('Manifest config or layers are not set');
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
