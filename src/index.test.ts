import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { makeDockerTarPusherLayer, pushToRegistry } from "./index";

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
  });
});
