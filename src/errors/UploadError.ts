export default class UploadError extends Error {
  constructor(
    message: string,
    public readonly context?: {
      fileName?: string;
      uploadUrl?: string;
      bytesUploaded?: number;
      totalBytes?: number;
      operation?: 'initiate' | 'chunk' | 'finalize';
    }
  ) {
    super(message);
    this.name = 'UploadError';
  }
}
