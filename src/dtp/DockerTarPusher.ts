import { createInstance } from '../config/axios';
import { applyConfiguration } from '../config/config';
import DockerTarPusherError from '../errors/DockerTarPusherError';
import type { ApplicationConfiguration, DockerTarPusherOptions, Manifest } from '../types';
import WorkDirUtils from '../utils/WorkDirUtils';
import { logger } from '../utils/logger';
import DockerImageUploader from './DockerImageUploader';
import DockerManifestUploader from './DockerManifestUploader';
import ManifestBuilder from './ManifestBuilder';

export default class DockerTarPusher {
  private readonly workDirUtils: WorkDirUtils;
  private readonly config: ApplicationConfiguration;
  private readonly dockerImageUploader: DockerImageUploader;
  private readonly dockerManifestUploader: DockerManifestUploader;

  constructor(options: DockerTarPusherOptions) {
    this.config = applyConfiguration(options);
    logger.info(`Docker Tar Pusher initialized with config: ${JSON.stringify(this.config)}`);
    this.workDirUtils = new WorkDirUtils();
    const manifestBuilder = new ManifestBuilder();
    const axios = createInstance(this.config);
    this.dockerImageUploader = new DockerImageUploader(this.workDirUtils, this.config, axios, manifestBuilder);
    this.dockerManifestUploader = new DockerManifestUploader(this.config, axios, manifestBuilder);
  }

  public async pushToRegistry(): Promise<void> {
    try {
      await this.prepareTarball();
      const { RepoTags, Layers, Config } = await this.loadManifest();
      for (const repoTag of RepoTags) {
        const [image, tag] = this.config.image
          ? [this.config.image.name, this.config.image.version]
          : repoTag.split(':');
        logger.info(`[${image}:${tag}] Push started.`);
        for await (const layer of Layers) {
          logger.debug(`[${image}:${tag}] Pushing layer ${layer.split('/')[0]}...`);
          await this.dockerImageUploader.handleLayer(image, layer);
        }
        logger.info(`[${image}:${tag}] Pushing config...`);
        await this.dockerImageUploader.handleConfig(image, Config);

        logger.info(`[${image}:${tag}] Pushing manifest...`);
        await this.dockerManifestUploader.pushManifest(image, tag);

        logger.info(`[${image}:${tag}] Push finished.`);
      }
    } finally {
      this.cleanUp();
    }
  }

  public cleanUp(): void {
    this.workDirUtils.cleanUp();
  }

  private async prepareTarball(): Promise<void> {
    await this.workDirUtils.createTempDir();
    await this.workDirUtils.extract(this.config.tarball);
  }

  private async loadManifest(): Promise<Manifest> {
    const { Layers, RepoTags, Config } = await this.workDirUtils.readManifest();
    if (!Layers || !Layers.length || !RepoTags || !RepoTags.length || !Config)
      throw new DockerTarPusherError('Manifest does not contain layers, repoTags or config information.', {
        manifest: {
          Layers,
          RepoTags,
          Config
        }
      });
    return {
      Layers,
      RepoTags,
      Config
    };
  }
}
