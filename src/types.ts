import { Effect, Schema } from "effect";

export const ManifestSchema = Schema.Struct({
  config: Schema.String,
  repoTags: Schema.Array(Schema.String),
  layers: Schema.Array(Schema.String),
}).pipe(
  Schema.encodeKeys({
    config: "Config",
    repoTags: "RepoTags",
    layers: "Layers",
  }),
);

const AuthSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
});

const ImageSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
});

export type ProgressEvent = {
  type: "layer" | "config" | "manifest";
  current: number;
  total: number;
  bytesUploaded: number;
  totalBytes: number;
  item: string;
};

export type ProgressCallback = (event: ProgressEvent) => void;

const ProgressCallbackSchema = Schema.declare(
  (u): u is ProgressCallback => typeof u === "function",
);

export const DockerTarPusherOptionsSchema = Schema.Struct({
  registryUrl: Schema.String,
  chunkSize: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(10 * 1024 * 1024)),
  ),
  sslVerify: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(true)),
  ),
  auth: Schema.optional(AuthSchema),
});

export const PushOptionsSchema = Schema.Struct({
  tarball: Schema.String,
  image: Schema.optional(ImageSchema),
  onProgress: Schema.optional(ProgressCallbackSchema),
});

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
