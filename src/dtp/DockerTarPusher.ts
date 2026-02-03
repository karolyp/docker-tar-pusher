import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract } from "tar";
import * as v from "valibot";
import ManifestError from "../errors/ManifestError";
import {
  type ApplicationConfiguration,
  type ChunkMetaData,
  DockerTarPusherOptionsSchema,
  ManifestSchema,
} from "../types";
import DockerRegistryService from "./DockerRegistryService";
import { buildManifest } from "./ManifestBuilder";

export type DockerTarPusherOptions = v.InferInput<
  typeof DockerTarPusherOptionsSchema
>;

export default class DockerTarPusher {
  private readonly config: ApplicationConfiguration;
  private readonly dockerRegistryService: DockerRegistryService;

  constructor(options: DockerTarPusherOptions) {
    this.config = v.parse(DockerTarPusherOptionsSchema, options);

    this.dockerRegistryService = new DockerRegistryService({
      chunkSize: this.config.chunkSize,
      registryUrl: this.config.registryUrl,
      sslVerify: this.config.sslVerify,
      auth: this.config.auth,
    });
  }

  async pushToRegistry() {
    const tempDir = await mkdtemp(join(tmpdir(), "dtp-"));
    try {
      await extract({ file: this.config.tarball, cwd: tempDir });

      const { repoTags, config, layers } = await this.readManifest(tempDir);

      for (const repoTag of repoTags) {
        const [image, tag] = this.config.image
          ? [this.config.image.name, this.config.image.version]
          : repoTag.split(":");
        const layersMetadata: ChunkMetaData[] = [];
        const layerPromises = layers.map(async (layer, index) => {
          this.config.onProgress?.({
            type: "layer",
            current: index + 1,
            total: layers.length,
            bytesUploaded: 0,
            totalBytes: 0,
            item: layer,
          });
          return this.dockerRegistryService.upload(tempDir, image, layer);
        });

        const layerResults = await Promise.all(layerPromises);
        for (const result of layerResults) {
          layersMetadata.push(result);
        }

        this.config.onProgress?.({
          type: "config",
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: config,
        });
        const configResult = await this.dockerRegistryService.upload(
          tempDir,
          image,
          config,
        );

        this.config.onProgress?.({
          type: "manifest",
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: `${image}:${tag}`,
        });

        const manifest = buildManifest(layersMetadata, configResult);
        await this.dockerRegistryService.pushManifest(manifest, image, tag);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async readManifest(cwd: string) {
    try {
      const rawManifest = await readFile(join(cwd, "manifest.json"), "utf8");
      const parsedManifest = JSON.parse(rawManifest)[0];

      return v.parse(ManifestSchema, parsedManifest);
    } catch {
      throw new ManifestError(`Failed to read manifest from ${cwd}`, {
        manifestPath: join(cwd, "manifest.json"),
        operation: "parse",
      });
    }
  }
}
