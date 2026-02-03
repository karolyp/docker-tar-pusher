import * as v from "valibot";

export const ManifestSchema = v.pipe(
  v.object({
    Config: v.string(),
    RepoTags: v.array(v.string()),
    Layers: v.array(v.string()),
  }),
  v.transform(({ Config, RepoTags, Layers }) => ({
    config: Config,
    repoTags: RepoTags,
    layers: Layers,
  })),
);

export type Manifest = v.InferOutput<typeof ManifestSchema>;

export const AuthSchema = v.object({
  username: v.string(),
  password: v.string(),
});

export const ImageSchema = v.object({
  name: v.string(),
  version: v.string(),
});

export const ProgressCallbackSchema = v.function();

export const DockerTarPusherOptionsSchema = v.object({
  registryUrl: v.string(),
  tarball: v.string(),
  chunkSize: v.fallback(v.number(), 10 * 1024 * 1024),
  sslVerify: v.fallback(v.boolean(), true),
  auth: v.optional(AuthSchema),
  image: v.optional(ImageSchema),
  onProgress: v.optional(ProgressCallbackSchema),
});

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

export type Auth = v.InferInput<typeof AuthSchema>;
export type Image = v.InferInput<typeof ImageSchema>;
export type ProgressCallback = v.InferInput<typeof ProgressCallbackSchema>;
export type ApplicationConfiguration = v.InferOutput<
  typeof DockerTarPusherOptionsSchema
>;
