import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { create } from "tar";
import { describe, expect, test } from "vitest";
import { makeDockerTarPusherLayer, pushToRegistry } from "./index";

const registryUrl = "http://localhost:1";

const tarballWithManifest = async (manifest: string) => {
  const dir = mkdtempSync(join(tmpdir(), "dtp-test-"));
  writeFileSync(join(dir, "manifest.json"), manifest);
  const file = join(dir, "image.tar");
  await create({ file, cwd: dir }, ["manifest.json"]);
  return file;
};

const run = async (tarball: string) => {
  const options = { tarball, registryUrl };
  return Effect.runPromiseExit(
    pushToRegistry(options).pipe(
      Effect.provide(makeDockerTarPusherLayer(options)),
    ),
  );
};

describe("manifest validation", () => {
  test.each([
    ["invalid json", "not json"],
    ["empty array", "[]"],
    ["null RepoTags", '[{"Config":"c","RepoTags":null,"Layers":[]}]'],
  ])("fails with ManifestError for %s", async (_, manifest) => {
    const exit = await run(await tarballWithManifest(manifest));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("ManifestError");
    expect(JSON.stringify(exit)).not.toContain('"Die"');
  });
});

describe("options validation", () => {
  test("rejects a non-function onProgress", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.void.pipe(
        Effect.provide(
          makeDockerTarPusherLayer({
            tarball: "x.tar",
            registryUrl,
            onProgress: true as never,
          }),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
