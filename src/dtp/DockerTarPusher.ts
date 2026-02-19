import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { extract } from "tar";
import { ManifestError } from "../errors/ManifestError";
import { DockerTarPusherOptionsSchema, ManifestSchema } from "../types";
import {
  type DockerRegistryServiceConfig,
  makeRegistryServiceLayer,
  RegistryService,
} from "./DockerRegistryService";
import { buildManifest } from "./ManifestBuilder";

export type DockerTarPusherOptions = Schema.Schema.Encoded<
  typeof DockerTarPusherOptionsSchema
>;

const decodeManifest = Schema.decodeUnknownSync(ManifestSchema);
const decodeOptions = Schema.decodeUnknownSync(DockerTarPusherOptionsSchema);

const readManifest = (cwd: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const manifestPath = join(cwd, "manifest.json");
    const rawManifest = yield* fs.readFileString(manifestPath);
    const parsedManifest = JSON.parse(rawManifest)[0];
    return decodeManifest(parsedManifest);
  }).pipe(
    Effect.mapError(
      () =>
        new ManifestError({
          message: `Failed to read manifest from ${cwd}`,
          context: {
            manifestPath: join(cwd, "manifest.json"),
            operation: "parse",
          },
        }),
    ),
  );

export const pushToRegistry = (options: DockerTarPusherOptions) => {
  const config = decodeOptions(options);

  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const registry = yield* RegistryService;

    const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "dtp-" });

    yield* Effect.tryPromise({
      try: () => extract({ file: config.tarball, cwd: tempDir }),
      catch: () =>
        new ManifestError({
          message: `Failed to extract tarball: ${config.tarball}`,
          context: { operation: "parse" },
        }),
    });

    const {
      repoTags,
      config: dockerConfig,
      layers,
    } = yield* readManifest(tempDir);

    for (const repoTag of repoTags) {
      const [image, tag] = config.image
        ? [config.image.name, config.image.version]
        : repoTag.split(":");

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

      const manifest = buildManifest(layerResults, configResult);
      yield* registry.pushManifest(manifest, image, tag);
    }
  }).pipe(Effect.scoped);
};

export const makeDockerTarPusherLayer = (options: DockerTarPusherOptions) => {
  const config = decodeOptions(options);
  const registryConfig: DockerRegistryServiceConfig = {
    chunkSize: config.chunkSize,
    registryUrl: config.registryUrl,
    sslVerify: config.sslVerify,
    auth: config.auth,
  };
  return Layer.merge(
    makeRegistryServiceLayer(registryConfig),
    NodeFileSystem.layer,
  );
};
