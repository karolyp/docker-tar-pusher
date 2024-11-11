import { DockerTarPusher } from '../src';
import { execSync } from 'node:child_process';

describe('test main', () => {
  const image = 'busybox';
  const outputFile = '/tmp/image.tar.gz';

  beforeAll(() => {
    execSync(`podman pull ${image}:latest`);
    execSync(`podman save ${image}:latest | gzip > ${outputFile}`);
  });

  it('should upload image to registry', async () => {
    const dtp = new DockerTarPusher({
      tarball: outputFile,
      registryUrl: process.env.REGISTRY_URL!
    });

    await expect(dtp.pushToRegistry()).resolves.not.toThrow();

    const result = await fetch(`${process.env.REGISTRY_URL}/v2/_catalog`, {
      method: 'GET'
    });

    const json = await result.json();

    expect(json).toEqual(
      expect.objectContaining({
        repositories: expect.arrayContaining([expect.stringContaining(image)])
      })
    );
  });
});
