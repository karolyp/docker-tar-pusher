export default class RegistryError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly context?: {
      url?: string;
      image?: string;
      tag?: string;
      operation?: string;
    },
  ) {
    super(message);
    this.name = "RegistryError";
  }
}
