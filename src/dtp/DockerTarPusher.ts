import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { extract } from "tar";
import { ManifestError } from "../errors/ManifestError.js";
import {
  ContentTypes,
  DockerTarPusherOptionsSchema,
  ManifestSchema,
  PushOptionsSchema,
  type RegistryManifest,
} from "../types.js";
import {
  makeRegistryServiceLayer,
  RegistryService,
} from "./DockerRegistryService.js";

export type DockerTarPusherOptions = Schema.Codec.Encoded<
  typeof DockerTarPusherOptionsSchema
>;

export type PushOptions = Schema.Codec.Encoded<typeof PushOptionsSchema>;

const decodeManifest = Schema.decodeUnknownEffect(ManifestSchema);
const decodeOptions = Schema.decodeUnknownEffect(DockerTarPusherOptionsSchema);
const decodePushOptions = Schema.decodeUnknownEffect(PushOptionsSchema);

const stripRegistryHost = (name: string) => {
  const [first = "", ...rest] = name.split("/");
  const isHost =
    first.includes(".") || first.includes(":") || first === "localhost";
  return rest.length > 0 && isHost ? rest.join("/") : name;
};

const splitRepoTag = (repoTag: string): [string, string] => {
  const separator = repoTag.lastIndexOf(":");
  const [name, tag] =
    separator > repoTag.lastIndexOf("/")
      ? [repoTag.slice(0, separator), repoTag.slice(separator + 1)]
      : [repoTag, "latest"];
  return [stripRegistryHost(name), tag];
};

const readManifest = (cwd: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const manifestPath = join(cwd, "manifest.json");
    const rawManifest = yield* fs.readFileString(manifestPath);
    const parsedManifest = yield* Effect.try(
      () => (JSON.parse(rawManifest) as unknown[])[0],
    );
    return yield* decodeManifest(parsedManifest);
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ManifestError({
          message: `Failed to read manifest from ${cwd}`,
          cause,
          context: {
            manifestPath: join(cwd, "manifest.json"),
            operation: "parse",
          },
        }),
    ),
  );

export const pushToRegistry = (options: PushOptions) =>
  Effect.gen(function* () {
    const config = yield* decodePushOptions(options);
    const fs = yield* FileSystem.FileSystem;
    const registry = yield* RegistryService;

    const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "dtp-" });

    yield* Effect.tryPromise({
      try: () => extract({ file: config.tarball, cwd: tempDir }),
      catch: (cause) =>
        new ManifestError({
          message: `Failed to extract tarball: ${config.tarball}`,
          cause,
          context: { operation: "parse" },
        }),
    });

    const {
      repoTags,
      config: dockerConfig,
      layers,
    } = yield* readManifest(tempDir);

    const targets = config.image
      ? [[config.image.name, config.image.version] as const]
      : repoTags.map(splitRepoTag);
    if (targets.length === 0) {
      return yield* new ManifestError({
        message: `Tarball has no repo tags, pass an image name and version: ${config.tarball}`,
        context: { operation: "validate" },
      });
    }
    const tagsByImage = new Map<string, Set<string>>();
    for (const [image, tag] of targets) {
      tagsByImage.set(image, (tagsByImage.get(image) ?? new Set()).add(tag));
    }

    for (const [image, tags] of tagsByImage) {
      const layerResults = yield* Effect.all(
        layers.map((layer, index) =>
          Effect.gen(function* () {
            yield* Effect.sync(() =>
              config.onProgress?.({
                type: "layer",
                current: index + 1,
                total: layers.length,
                bytesUploaded: 0,
                totalBytes: 0,
                item: layer,
              }),
            );
            return yield* registry.upload(tempDir, image, layer);
          }),
        ),
        { concurrency: "unbounded" },
      );

      yield* Effect.sync(() =>
        config.onProgress?.({
          type: "config",
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: dockerConfig,
        }),
      );

      const configResult = yield* registry.upload(tempDir, image, dockerConfig);

      const manifest: RegistryManifest = {
        config: {
          ...configResult,
          mediaType: ContentTypes.APPLICATION_CONFIG,
        },
        layers: layerResults.map((layer) => ({
          ...layer,
          mediaType: ContentTypes.APPLICATION_LAYER,
        })),
        schemaVersion: 2,
        mediaType: ContentTypes.APPLICATION_MANIFEST,
      };

      for (const tag of tags) {
        yield* Effect.sync(() =>
          config.onProgress?.({
            type: "manifest",
            current: 1,
            total: 1,
            bytesUploaded: 0,
            totalBytes: 0,
            item: `${image}:${tag}`,
          }),
        );
        yield* registry.pushManifest(manifest, image, tag);
      }
    }
  }).pipe(Effect.scoped);

export const makeDockerTarPusherLayer = (options: DockerTarPusherOptions) =>
  Layer.unwrap(
    decodeOptions(options).pipe(
      Effect.map((config) =>
        Layer.merge(
          makeRegistryServiceLayer({
            chunkSize: config.chunkSize,
            registryUrl: config.registryUrl,
            sslVerify: config.sslVerify,
            auth: config.auth,
          }),
          NodeFileSystem.layer,
        ),
      ),
    ),
  );
