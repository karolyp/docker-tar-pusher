import { DockerTarPusherOptions, ApplicationConfiguration } from './types';

const defaultConfiguration: Pick<ApplicationConfiguration, 'quiet' | 'chunkSize' | 'sslVerify'> = {
  quiet: true,
  sslVerify: true,
  chunkSize: 10 * 1024 * 1024
};

export const getConfiguration = (options: DockerTarPusherOptions): ApplicationConfiguration => {
  return {
    ...defaultConfiguration,
    ...options
  };
};
