import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { extract } from "tar";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { makeDockerTarPusherLayer, pushToRegistry } from "./index.js";

const images = ["busybox", "alpine", "nginx"];
const registryUrl = process.env.REGISTRY_URL || "http://localhost:15000";

beforeAll(() => {
  for (const image of images) {
    execSync(`docker pull ${image}:latest`);
    execSync(`docker save ${image}:latest | gzip > /tmp/${image}.tar.gz`);
  }
}, 120_000);

afterAll(() => {
  for (const image of images) {
    rmSync(`/tmp/${image}.tar.gz`, { force: true });
  }
});

const sha256 = (file: string) =>
  `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;

const expectedDigests = async (tarball: string) => {
  const cwd = mkdtempSync(join(tmpdir(), "dtp-verify-"));
  await extract({ file: tarball, cwd });
  const [entry] = JSON.parse(readFileSync(join(cwd, "manifest.json"), "utf8"));
  return {
    config: sha256(join(cwd, entry.Config)),
    layers: (entry.Layers as string[]).map((layer) => sha256(join(cwd, layer))),
  };
};

describe("DockerTarPusher", () => {
  test.each(images)("should upload %s to registry", async (image) => {
    const options = { tarball: `/tmp/${image}.tar.gz`, registryUrl };
    const layer = makeDockerTarPusherLayer(options);

    await Effect.runPromise(
      pushToRegistry(options).pipe(Effect.provide(layer)),
    );

    const result = await fetch(`${registryUrl}/v2/_catalog`);
    const json = (await result.json()) as { repositories: string[] };

    expect(json.repositories).toContain(image);

    const manifestResponse = await fetch(
      `${registryUrl}/v2/${image}/manifests/latest`,
      {
        headers: {
          Accept: "application/vnd.docker.distribution.manifest.v2+json",
        },
      },
    );
    const manifest = (await manifestResponse.json()) as {
      config: { digest: string };
      layers: { digest: string }[];
    };
    const expected = await expectedDigests(options.tarball);

    expect(manifest.config.digest).toBe(expected.config);
    expect(manifest.layers.map((layer) => layer.digest)).toEqual(
      expected.layers,
    );
    for (const digest of [expected.config, ...expected.layers]) {
      const blob = await fetch(`${registryUrl}/v2/${image}/blobs/${digest}`, {
        method: "HEAD",
      });
      expect(blob.status).toBe(200);
    }
  });
});
