import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extract } from 'tar';
import * as v from 'valibot';
import { AxiosInstance } from 'axios';
import { createInstance } from '../config/axios';
import { applyConfiguration } from '../config/config';
import ManifestError from '../errors/ManifestError';
import { ManifestSchema, type ApplicationConfiguration, type DockerTarPusherOptions } from '../types';
import DockerRegistryService from './DockerRegistryService';
import ManifestBuilder from './ManifestBuilder';

export default class DockerTarPusher {
  private readonly config: ApplicationConfiguration;
  private readonly dockerRegistryService: DockerRegistryService;
  private readonly axios: AxiosInstance;
  private readonly manifestBuilder: ManifestBuilder;

  constructor(options: DockerTarPusherOptions) {
    this.config = applyConfiguration(options);
    this.manifestBuilder = new ManifestBuilder();
    this.axios = createInstance(this.config);
    this.dockerRegistryService = new DockerRegistryService(this.config, this.axios, this.manifestBuilder);
  }

  async pushToRegistry() {
    let tempDir: string | null = null;
    try {
      const workDir = await mkdtemp(join(tmpdir(), 'dtp-'));
      await extract({ file: this.config.tarball, cwd: workDir });

      const { RepoTags, Layers, Config } = await this.readManifest(workDir);

      for (const repoTag of RepoTags) {
        const [image, tag] = this.config.image
          ? [this.config.image.name, this.config.image.version]
          : repoTag.split(':');
        const layerPromises = Layers.map(async (layer, index) => {
          this.config.onProgress?.({
            type: 'layer',
            current: index + 1,
            total: Layers.length,
            bytesUploaded: 0,
            totalBytes: 0,
            item: layer
          });
          return this.dockerRegistryService.uploadLayer(workDir, image, layer);
        });

        await Promise.all(layerPromises);

        this.config.onProgress?.({
          type: 'config',
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: Config
        });
        await this.dockerRegistryService.uploadConfig(workDir, image, Config);

        this.config.onProgress?.({
          type: 'manifest',
          current: 1,
          total: 1,
          bytesUploaded: 0,
          totalBytes: 0,
          item: `${image}:${tag}`
        });
        await this.dockerRegistryService.pushManifest(image, tag);
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  private async readManifest(cwd: string) {
    try {
      const rawManifest = await readFile(join(cwd, 'manifest.json'), 'utf8');
      const parsedManifest = JSON.parse(rawManifest)[0];

      return v.parse(ManifestSchema, parsedManifest);
    } catch (e) {
      throw new ManifestError(`Failed to read manifest from ${cwd}`, {
        manifestPath: join(cwd, 'manifest.json'),
        operation: 'parse'
      });
    }
  }
}
