import fs from 'fs';
import path from 'path';
import os from 'os';
import tar from 'tar';
import { Headers, Manifest, RequestHeaders, ContentTypes } from './types';

export default class Utils {
  private readonly cwd: string;

  constructor(prefix = 'dtp-') {
    this.cwd = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    process.on('SIGINT', () => {
      this.cleanUp();
      process.exit();
    });
  }

  public extract(archive: string): void {
    try {
      tar.extract({ file: archive, cwd: this.cwd, sync: true });
    } catch ({ message }) {
      throw new Error(`Cannot extract ${archive}. Message: ${message}`);
    }
  }

  public cleanUp(): void {
    fs.rmSync(this.cwd, { recursive: true });
  }

  public readManifest(): Manifest {
    const rawManifest = fs.readFileSync(path.join(this.cwd, 'manifest.json')).toString();
    return JSON.parse(rawManifest)[0] as Manifest;
  }

  public async *readChunks(file: string, chunkSize: number): AsyncIterableIterator<Buffer> {
    const readStream = fs.createReadStream(path.join(this.cwd, file), {
      highWaterMark: chunkSize
    });
    for await (const chunk of readStream) {
      yield chunk;
    }
  }

  public getUploadHeaders(start: number, length: number): Headers {
    return {
      [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_OCTET_STREAM,
      [RequestHeaders.CONTENT_LENGTH]: length,
      [RequestHeaders.CONTENT_RANGE]: `${start}-${start + length}`
    };
  }
}
