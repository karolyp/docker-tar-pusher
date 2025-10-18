import * as v from 'valibot';
import type { ApplicationConfiguration, DockerTarPusherOptions } from '../types';
import { DockerTarPusherOptionsSchema } from '../types';
import { consoleLogger, logger, setApplicationLogger } from '../utils/logger';

const defaultConfiguration: Pick<ApplicationConfiguration, 'logger' | 'chunkSize' | 'sslVerify'> = {
  logger: consoleLogger,
  sslVerify: true,
  chunkSize: 10 * 1024 * 1024
};

export const applyConfiguration = (options: DockerTarPusherOptions): ApplicationConfiguration => {
  // Validate input options
  const validatedOptions = v.parse(DockerTarPusherOptionsSchema, options);

  // Create final application configuration
  const applicationConfiguration = {
    ...defaultConfiguration,
    ...validatedOptions
  };

  setApplicationLogger(applicationConfiguration.logger);

  // Check if HTTP(S) protocol is set
  if (!applicationConfiguration.registryUrl.startsWith('http')) {
    logger.warn('Docker registry URL protocol is invalid. Assuming http...');
    applicationConfiguration.registryUrl = `http://${applicationConfiguration.registryUrl}`;
  }
  
  return applicationConfiguration;
};
