import { DockerTarPusher } from './index';
import { execSync } from 'node:child_process';
import { before, test } from 'node:test';
import assert from 'node:assert';

const image = 'busybox';
const outputFile = '/tmp/image.tar.gz';

before(() => {
  const docker = process.env.GITHUB_ACTIONS ? 'docker' : 'podman';
  execSync(`${docker} pull ${image}:latest`);
  execSync(`${docker} save ${image}:latest | gzip > ${outputFile}`);
});

test('should upload image to registry', async () => {
  const dtp = new DockerTarPusher({
    tarball: outputFile,
    registryUrl: process.env.REGISTRY_URL!
  });

  // Assert that pushing the image to the registry does not throw
  await assert.doesNotReject(dtp.pushToRegistry());

  // Verify the image exists in the registry by querying the catalog
  const result = await fetch(`${process.env.REGISTRY_URL}/v2/_catalog`, {
    method: 'GET'
  });

  const json = await result.json();

  // Ensure the image is in the registry catalog
  assert.ok(json.repositories.some((repo: any) => repo.includes(image)));
});
