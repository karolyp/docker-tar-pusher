import { Schema } from "effect";

export const ManifestSchema = Schema.transform(
  Schema.Struct({
    Config: Schema.String,
    RepoTags: Schema.Array(Schema.String),
    Layers: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    config: Schema.String,
    repoTags: Schema.Array(Schema.String),
    layers: Schema.Array(Schema.String),
  }),
  {
    decode: ({ Config, RepoTags, Layers }) => ({
      config: Config,
      repoTags: RepoTags,
      layers: Layers,
    }),
    encode: ({ config, repoTags, layers }) => ({
      Config: config,
      RepoTags: repoTags,
      Layers: layers,
    }),
  },
);

export const AuthSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
});

export const ImageSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
});

const DockerTarPusherOptionsInput = Schema.Struct({
  registryUrl: Schema.String,
  tarball: Schema.String,
  chunkSize: Schema.optional(Schema.Number),
  sslVerify: Schema.optional(Schema.Boolean),
  auth: Schema.optional(AuthSchema),
  image: Schema.optional(ImageSchema),
  onProgress: Schema.optional(Schema.Any),
});

export const DockerTarPusherOptionsSchema = Schema.transform(
  DockerTarPusherOptionsInput,
  Schema.Struct({
    registryUrl: Schema.String,
    tarball: Schema.String,
    chunkSize: Schema.Number,
    sslVerify: Schema.Boolean,
    auth: Schema.optional(AuthSchema),
    image: Schema.optional(ImageSchema),
    onProgress: Schema.optional(Schema.Any),
  }),
  {
    decode: (input) => ({
      ...input,
      chunkSize: input.chunkSize ?? 10 * 1024 * 1024,
      sslVerify: input.sslVerify ?? true,
    }),
    encode: (output) => output,
  },
);

export type ImageLayer = {
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
  layers: ImageLayer[];
};

export type Headers = {
  [key: string]: string;
};

export type ChunkMetaData = {
  digest: string;
  size: number;
};

export enum RequestHeaders {
  CONTENT_TYPE = "Content-Type",
  CONTENT_LENGTH = "Content-Length",
  CONTENT_RANGE = "Content-Range",
}

export enum ContentTypes {
  APPLICATION_OCTET_STREAM = "application/octet-stream",
  APPLICATION_MANIFEST = "application/vnd.docker.distribution.manifest.v2+json",
  APPLICATION_LAYER = "application/vnd.docker.image.rootfs.diff.tar",
  APPLICATION_CONFIG = "application/vnd.docker.container.image.v1+json",
}

export type Auth = Schema.Schema.Type<typeof AuthSchema>;
export type ApplicationConfiguration = Schema.Schema.Type<
  typeof DockerTarPusherOptionsSchema
>;
