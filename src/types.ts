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

export const AuthSchema = v.object({
  username: v.string(),
  password: v.string(),
});

export const ImageSchema = v.object({
  name: v.string(),
  version: v.string(),
});

export const ProgressCallbackSchema = v.function();

export const DockerTarPusherOptionsSchema = v.pipe(
  v.object({
    registryUrl: v.string(),
    tarball: v.string(),
    chunkSize: v.optional(v.number()),
    sslVerify: v.optional(v.boolean()),
    auth: v.optional(AuthSchema),
    image: v.optional(ImageSchema),
    onProgress: v.optional(ProgressCallbackSchema),
  }),
  v.transform((input) => ({
    ...input,
    chunkSize: input.chunkSize ?? 10 * 1024 * 1024,
    sslVerify: input.sslVerify ?? true,
  })),
);

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
export type ApplicationConfiguration = v.InferOutput<
  typeof DockerTarPusherOptionsSchema
>;
