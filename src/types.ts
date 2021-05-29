export type Manifest = {
  Config: string;
  RepoTags: string[];
  Layers: string[];
};

export type Layer = {
  size: number;
  digest: string;
  mediaType: string;
};

export type Config = {
  mediaType: string;
  size: number;
  digest: string;
};

export type RegistryManifest = {
  schemaVersion: number;
  mediaType: string;
  config: Config;
  layers: Layer[];
};

export type DockerTarPusherOptions = {
  registryUrl: string;
  tarball: string;
  chunkSize?: number;
};

export type Headers = {
  [key: string]: string | number;
};

export type MetaData = {
  digest: string;
  size: number;
};
