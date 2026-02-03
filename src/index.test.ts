import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DockerTarPusher } from "./index";

const images = ["busybox", "alpine", "nginx"];
const registryUrl = process.env.REGISTRY_URL || "http://localhost:5000";

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
    const dtp = new DockerTarPusher({
      tarball: `/tmp/${image}.tar.gz`,
      registryUrl,
    });

    await dtp.pushToRegistry();

    const result = await fetch(`${registryUrl}/v2/_catalog`);
    const json = (await result.json()) as { repositories: string[] };

    expect(json.repositories).toContain(image);
  });
});
