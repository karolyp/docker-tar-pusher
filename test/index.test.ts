import { DockerTarPusher } from '../src';

describe('test main', () => {
  it('should upload image to registry', async () => {
    const dtp = new DockerTarPusher({
      tarball: process.env.TARBALL!,
      registryUrl: process.env.REGISTRY_URL!
    });

    await expect(dtp.pushToRegistry()).resolves.not.toThrow();
  });
});
