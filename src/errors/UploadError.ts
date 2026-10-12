import { Data } from "effect";

export class UploadError extends Data.TaggedError("UploadError")<{
  message: string;
  cause?: unknown;
  statusCode?: number;
  context?: {
    fileName?: string;
    uploadUrl?: string;
    bytesUploaded?: number;
    totalBytes?: number;
    operation?: "initiate" | "chunk" | "finalize";
  };
}> {}
