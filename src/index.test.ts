import { execSync } from 'node:child_process';
import { DockerTarPusher } from './index';

const image = 'busybox';
const tarball = '/tmp/image.tar.gz';
const registryUrl = process.env.REGISTRY_URL || 'http://localhost:5000';
const docker = process.env.CI ? 'docker' : 'podman';

beforeAll(() => {
  execSync(`${docker} pull ${image}:latest`);
  execSync(`${docker} save ${image}:latest | gzip > ${tarball}`);
});

test('should upload image to registry', async () => {
  const dtp = new DockerTarPusher({
    tarball,
    registryUrl
  });

  await expect(dtp.pushToRegistry()).resolves.not.toThrow();

  const result = await fetch(`${registryUrl}/v2/_catalog`, {
    method: 'GET'
  });

  const json = (await result.json()) as { repositories: string[] };

  expect(json.repositories).toEqual(expect.arrayContaining([expect.stringContaining(image)]));
});
