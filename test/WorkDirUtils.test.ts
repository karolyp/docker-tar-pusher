import tar from 'tar';
import fs from 'fs';
import os from 'os';
import WorkDirUtils from '../src/WorkDirUtils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { rawManifest } from './fixtures/manifest';

jest.mock('tar');
jest.mock('fs');
jest.mock('os');

describe('test utils', () => {
  let utils: WorkDirUtils;

  beforeEach(() => {
    (os.tmpdir as jest.Mock).mockReturnValue('/tmp');
    (fs.mkdtempSync as jest.Mock).mockReturnValue('/tmp/folder/pref-rand');
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    utils = new WorkDirUtils();
    utils.createTempDir('pref-');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should extract archive', () => {
    // when
    utils.extract('/data/busybox.tar');

    // then
    expect(fs.mkdtempSync).toHaveBeenCalledWith('/tmp/pref-');
    expect(tar.extract).toHaveBeenCalledWith({
      file: '/data/busybox.tar',
      cwd: '/tmp/folder/pref-rand',
      sync: true
    });
  });

  it('should throw error when extract fails', () => {
    // given
    (tar.extract as jest.Mock).mockImplementation(() => {
      throw new Error();
    });

    // when - then
    expect(() => {
      utils.extract('/fail');
    }).toThrowError('Cannot extract');
  });

  it('should clear files', () => {
    // when
    utils.cleanUp();

    // then
    expect(fs.rmSync).toHaveBeenCalledTimes(1);
  });

  it('should clean up before stopping application', () => {
    // given
    jest.spyOn(process, 'exit').mockImplementation(() => {
      // then
      expect(fs.rmSync).toHaveBeenCalledWith('/tmp/folder/pref-rand', { recursive: true });
      return undefined as never;
    });

    // when (simulate Ctrl+C)
    process.emit('SIGINT', 'SIGINT');
  });

  it('should parse manifest file', () => {
    // given
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from(rawManifest));

    // when
    const manifest = utils.readManifest();

    // then
    expect(manifest).toEqual({
      Config: 'a29f45ccde2ac0bde957b1277b1501f471960c8ca49f1588c6c885941640ae60.json',
      RepoTags: ['hello-world:latest'],
      Layers: ['64b31f3fb4704376464f3269e8c303930e10084d2df4ace379900150c71e38cf/layer.tar']
    });
  });
});
