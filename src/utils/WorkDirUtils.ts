import tar from 'tar';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Manifest } from '../types';
import DockerTarPusherError from '../errors/DockerTarPusherError';
import WorkingDirectoryNotSetError from '../errors/WorkingDirectoryNotSetError';

export default class WorkDirUtils {
  private cwd?: string;

  public async createTempDir(prefix = 'dtp-'): Promise<void> {
    this.cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  public async extract(archive: string): Promise<void> {
    if (!this.cwd) throw new WorkingDirectoryNotSetError();

    try {
      await tar.extract({ file: archive, cwd: this.cwd });
    } catch ({ message }) {
      throw new DockerTarPusherError(`Cannot extract ${archive}. Message: ${message}`, {
        cwd: this.cwd,
        file: archive
      });
    }
  }

  public cleanUp(): void {
    // Must use sync calls to be able to call it from sync shutdown hooks
    if (this.cwd && fs.existsSync(this.cwd)) {
      if (fs.rmSync) {
        fs.rmSync(this.cwd, { recursive: true });
      } else {
        // supporting Node versions older than 14.14
        fs.rmdirSync(this.cwd, { recursive: true });
      }
    }
  }

  public async readManifest(): Promise<Partial<Manifest>> {
    if (!this.cwd) throw new WorkingDirectoryNotSetError();

    const rawManifest = (await fs.promises.readFile(path.join(this.cwd, 'manifest.json'))).toString();
    return JSON.parse(rawManifest)[0] as Partial<Manifest>;
  }

  public async *readChunks(file: string, chunkSize: number): AsyncIterableIterator<Buffer> {
    if (!this.cwd) throw new WorkingDirectoryNotSetError();

    const readStream = fs.createReadStream(path.join(this.cwd, file), {
      highWaterMark: chunkSize
    });
    for await (const chunk of readStream) {
      yield chunk;
    }
  }

  public async getFileSize(file: string): Promise<number> {
    if (!this.cwd) throw new WorkingDirectoryNotSetError();

    const { size } = await fs.promises.stat(path.join(this.cwd, file));
    return size;
  }
}
