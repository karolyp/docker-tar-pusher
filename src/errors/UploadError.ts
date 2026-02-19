import { Data } from "effect";

export class UploadError extends Data.TaggedError("UploadError")<{
  message: string;
  context?: {
    fileName?: string;
    uploadUrl?: string;
    bytesUploaded?: number;
    totalBytes?: number;
    operation?: "initiate" | "chunk" | "finalize";
  };
}> {}
