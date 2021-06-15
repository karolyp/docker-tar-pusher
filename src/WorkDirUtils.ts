import fs from 'fs';
import path from 'path';
import os from 'os';
import tar from 'tar';
import { Manifest } from './types';

export default class WorkDirUtils {
  private cwd?: string;

  public createTempDir(prefix = 'dtp-'): void {
    this.cwd = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  }

  public extract(archive: string): void {
    try {
      tar.extract({ file: archive, cwd: this.cwd, sync: true });
    } catch ({ message }) {
      throw new Error(`Cannot extract ${archive}. Message: ${message}`);
    }
  }

  public cleanUp(): void {
    if (this.cwd && fs.existsSync(this.cwd)) {
      if (fs.rmSync) {
        fs.rmSync(this.cwd, { recursive: true });
      } else {
        // supporting Node versions older than 14.14
        fs.rmdirSync(this.cwd, { recursive: true });
      }
    }
  }

  public readManifest(): Manifest {
    if (!this.cwd) {
      throw new Error('Working directory is not set!');
    }
    const rawManifest = fs.readFileSync(path.join(this.cwd, 'manifest.json')).toString();
    return JSON.parse(rawManifest)[0] as Manifest;
  }

  public async* readChunks(file: string, chunkSize: number): AsyncIterableIterator<Buffer> {
    if (!this.cwd) {
      throw new Error('Working directory is not set!');
    }
    const readStream = fs.createReadStream(path.join(this.cwd, file), {
      highWaterMark: chunkSize
    });
    for await (const chunk of readStream) {
      yield chunk;
    }
  }

  public getFileSize(file: string): number {
    if (!this.cwd) {
      throw new Error('Working directory is not set!');
    }
    const { size } = fs.statSync(path.join(this.cwd, file));
    return size;
  }
}
