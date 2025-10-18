import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract } from "tar";
import * as v from "valibot";
import ManifestError from "../errors/ManifestError";
import {
  type ApplicationConfiguration,
  type DockerTarPusherOptionsSchema,
  ManifestSchema,
} from "../types";
import DockerRegistryService from "./DockerRegistryService";
import ManifestBuilder from "./ManifestBuilder";

export type DockerTarPusherOptions = v.InferInput<
  typeof DockerTarPusherOptionsSchema
>;

export default class DockerTarPusher {
  private readonly config: ApplicationConfiguration;
  private readonly dockerRegistryService: DockerRegistryService;

  constructor(options: DockerTarPusherOptions) {
    this.config = {
      sslVerify: true,
      chunkSize: 10 * 1024 * 1024,
      ...options,
    };

    this.dockerRegistryService = new DockerRegistryService({
      chunkSize: this.config.chunkSize,
      registryUrl: this.config.registryUrl,
      sslVerify: this.config.sslVerify,
      auth: this.config.auth,
    });
  }

  async pushToRegistry() {
    const manifestBuilder = new ManifestBuilder();
    const tempDir: string | null = null;
    try {
      const workDir = await mkdtemp(join(tmpdir(), "dtp-"));
      await extract({ file: this.config.tarball, cwd: workDir });

      const { RepoTags, Layers, Config } = await this.readManifest(workDir);

      for (const repoTag of RepoTags) {
        const [image, tag] = this.config.image
          ? [this.config.image.name, this.config.image.version]
          : repoTag.split(":");
        const layerPromises = Layers.map(async (layer, index) => {
          this.config.onProgress?.({
            type: "layer",
            current: index + 1,
            total: Layers.length,
            bytesUploaded: 0,
            totalBytes: 0,
            item: layer,
          });
          return this.dockerRegistryService.upload(workDir, image, layer);
        });

        const layerResults = await Promise.all(layerPromises);
        for (const result of layerResults) {
          manifestBuilder.addLayer(result);
        }

        this.config.onProgress?.({
          type: "config",
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: Config,
        });
        const configResult = await this.dockerRegistryService.upload(
          workDir,
          image,
          Config,
        );
        manifestBuilder.setConfig(configResult);

        this.config.onProgress?.({
          type: "manifest",
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: `${image}:${tag}`,
        });

        const manifest = manifestBuilder.buildManifest();
        await this.dockerRegistryService.pushManifest(manifest, image, tag);
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
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
