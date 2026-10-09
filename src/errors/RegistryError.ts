import { Data } from "effect";

export class RegistryError extends Data.TaggedError("RegistryError")<{
  message: string;
  cause?: unknown;
  statusCode?: number;
  context?: { url?: string; image?: string; tag?: string; operation?: string };
}> {}
