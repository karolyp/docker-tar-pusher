import { Data } from "effect";

export class ManifestError extends Data.TaggedError("ManifestError")<{
  message: string;
  context?: {
    manifestPath?: string;
    layer?: string;
    config?: string;
    operation?: "parse" | "build" | "validate";
  };
}> {}
