export default class DockerTarPusherError extends Error {
  constructor(message: string, public readonly context?: unknown) {
    super(message);
  }
}
