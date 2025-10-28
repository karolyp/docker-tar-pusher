export default class ManifestError extends Error {
  constructor(
    message: string,
    public readonly context?: {
      manifestPath?: string;
      layer?: string;
      config?: string;
      operation?: "parse" | "build" | "validate";
    },
  ) {
    super(message);
    this.name = "ManifestError";
  }
}
