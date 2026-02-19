import { Data } from "effect";

export class RegistryError extends Data.TaggedError("RegistryError")<{
  message: string;
  statusCode?: number;
  context?: { url?: string; image?: string; tag?: string; operation?: string };
}> {}
