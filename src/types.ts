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
  quiet?: boolean;
  sslVerify?: boolean;
  auth?: {
    username: string;
    password: string;
  };
};

export type Headers = {
  [key: string]: string | number;
};

export type MetaData = {
  digest: string;
  size: number;
};

export const RequestHeaders = {
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  CONTENT_RANGE: 'Content-Range'
};

export const ContentTypes = {
  APPLICATION_OCTET_STREAM: 'application/octet-stream',
  APPLICATION_MANIFEST: 'application/vnd.docker.distribution.manifest.v2+json',
  APPLICATION_LAYER: 'application/vnd.docker.image.rootfs.diff.tar',
  APPLICATION_CONFIG: 'application/vnd.docker.container.image.v1+json'
};

export type LoggerConfig = {
  quiet: boolean;
};

export type ApplicationConfiguration = {
  registryUrl: string;
  tarball: string;
  chunkSize: number;
  quiet: boolean;
  sslVerify: boolean;
  auth?: {
    username: string;
    password: string;
  };
};
