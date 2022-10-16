import DockerTarPusherError from './DockerTarPusherError';

export default class WorkingDirectoryNotSetError extends DockerTarPusherError {
  constructor() {
    super('Working directory is not set!');
  }
}
