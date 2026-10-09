import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { create } from "tar";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  makeDockerTarPusherLayer,
  type ProgressEvent,
  pushToRegistry,
} from "./index";

type Recorded = {
  method: string;
  url: URL;
  headers: IncomingMessage["headers"];
  body: Buffer;
};
type Reply = { status: number; location?: string };
type Handler = (request: Recorded) => Reply | undefined;

let server: Server;
let registryUrl: string;
let requests: Recorded[];
let override: Handler;

const defaultReply = ({ method, url }: Recorded): Reply => {
  if (method === "POST") return { status: 202, location: "/upload/1" };
  if (method === "PATCH") return { status: 202, location: "/upload/1?next=1" };
  if (url.pathname.includes("/manifests/")) return { status: 201 };
  return { status: 201 };
};

beforeEach(async () => {
  requests = [];
  override = () => undefined;
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const recorded: Recorded = {
        method: req.method ?? "",
        url: new URL(req.url ?? "/", "http://localhost"),
        headers: req.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(recorded);
      const reply = override(recorded) ?? defaultReply(recorded);
      res.writeHead(
        reply.status,
        reply.location ? { Location: reply.location } : {},
      );
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  registryUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const buildTarball = async (repoTag = "localhost:5000/app:1.0") => {
  const dir = mkdtempSync(join(tmpdir(), "dtp-registry-test-"));
  writeFileSync(join(dir, "config.json"), "0123456789");
  writeFileSync(join(dir, "layer.tar"), "abcdefghij");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify([
      { Config: "config.json", RepoTags: [repoTag], Layers: ["layer.tar"] },
    ]),
  );
  const file = join(dir, "image.tar");
  await create({ file, cwd: dir }, [
    "manifest.json",
    "config.json",
    "layer.tar",
  ]);
  return file;
};

type Options = Partial<Parameters<typeof makeDockerTarPusherLayer>[0]>;

const push = async (tarball: string, options: Options = {}) => {
  const all = { tarball, registryUrl, chunkSize: 4, ...options };
  return Effect.runPromise(
    pushToRegistry(all).pipe(Effect.provide(makeDockerTarPusherLayer(all))),
  );
};

const fail = async (tarball: string, options: Options = {}) => {
  const all = { tarball, registryUrl, chunkSize: 4, ...options };
  return Effect.runPromise(
    pushToRegistry(all).pipe(
      Effect.flip,
      Effect.provide(makeDockerTarPusherLayer(all)),
    ),
  );
};

describe("successful push", () => {
  test("uploads chunks, finalizes with an encoded digest and pushes the manifest", async () => {
    await push(await buildTarball());

    const patches = requests.filter((r) => r.method === "PATCH");
    const finals = requests.filter(
      (r) => r.method === "PUT" && r.url.searchParams.has("digest"),
    );
    const manifest = requests.find((r) =>
      r.url.pathname.includes("/manifests/"),
    );

    expect(patches.length).toBeGreaterThan(0);
    expect(finals).toHaveLength(2);
    for (const final of finals) {
      expect(final.url.searchParams.get("digest")).toMatch(
        /^sha256:[0-9a-f]{64}$/,
      );
      expect(final.url.search).toContain("digest=sha256%3A");
    }
    expect(manifest?.url.pathname).toBe("/v2/localhost:5000/app/manifests/1.0");
    expect(manifest?.headers["content-type"]).toBe(
      "application/vnd.docker.distribution.manifest.v2+json",
    );
  });

  test("tags untagged repo tags as latest", async () => {
    await push(await buildTarball("app"));

    const manifest = requests.find((r) =>
      r.url.pathname.includes("/manifests/"),
    );
    expect(manifest?.url.pathname).toBe("/v2/app/manifests/latest");
  });

  test("uses the image override instead of the repo tag", async () => {
    await push(await buildTarball(), {
      image: { name: "custom", version: "9.9" },
    });

    const manifest = requests.find((r) =>
      r.url.pathname.includes("/manifests/"),
    );
    expect(manifest?.url.pathname).toBe("/v2/custom/manifests/9.9");
  });

  test("sends basic auth when configured", async () => {
    await push(await buildTarball(), {
      auth: { username: "u", password: "p" },
    });

    const expected = `Basic ${Buffer.from("u:p").toString("base64")}`;
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.headers.authorization).toBe(expected);
    }
  });

  test("does not send auth by default", async () => {
    await push(await buildTarball());

    expect(requests.every((r) => r.headers.authorization === undefined)).toBe(
      true,
    );
  });

  test("reports progress for layers, config and manifest", async () => {
    const events: ProgressEvent[] = [];
    await push(await buildTarball(), { onProgress: (e) => events.push(e) });

    expect(events.map((e) => e.type)).toEqual(["layer", "config", "manifest"]);
    expect(events[2]?.item).toBe("localhost:5000/app:1.0");
  });

  test("follows redirects", async () => {
    override = ({ method, url }) =>
      method === "POST" &&
      url.pathname === "/v2/localhost:5000/app/blobs/uploads/"
        ? { status: 307, location: "/redirected/" }
        : method === "POST"
          ? { status: 202, location: "/upload/1" }
          : undefined;

    await push(await buildTarball());

    expect(requests.some((r) => r.url.pathname === "/redirected/")).toBe(true);
  });
});

describe("failures", () => {
  test("initiate upload failure keeps the status code", async () => {
    override = ({ method }) =>
      method === "POST" ? { status: 401 } : undefined;

    const error = await fail(await buildTarball());

    expect(error).toMatchObject({
      _tag: "RegistryError",
      statusCode: 401,
      context: { operation: "initiate_upload" },
    });
  });

  test("a response without a Location header fails", async () => {
    override = ({ method }) =>
      method === "POST" ? { status: 202 } : undefined;

    const error = await fail(await buildTarball());

    expect(error).toMatchObject({ _tag: "RegistryError" });
    expect(String((error as { cause: unknown }).cause)).toContain("Location");
  });

  test("chunk upload failure keeps status code and progress", async () => {
    override = ({ method }) =>
      method === "PATCH" ? { status: 500 } : undefined;

    const error = await fail(await buildTarball());

    expect(error).toMatchObject({
      _tag: "UploadError",
      statusCode: 500,
      context: { operation: "chunk", bytesUploaded: 0, totalBytes: 10 },
    });
    expect((error as { cause: unknown }).cause).toBeDefined();
  });

  test("manifest push failure keeps the status code", async () => {
    override = ({ url }) =>
      url.pathname.includes("/manifests/") ? { status: 400 } : undefined;

    const error = await fail(await buildTarball());

    expect(error).toMatchObject({
      _tag: "RegistryError",
      statusCode: 400,
      context: { operation: "push_manifest", tag: "1.0" },
    });
  });

  test("a missing tarball fails with ManifestError", async () => {
    const error = await fail(join(tmpdir(), "does-not-exist.tar"));

    expect(error).toMatchObject({ _tag: "ManifestError" });
  });
});
