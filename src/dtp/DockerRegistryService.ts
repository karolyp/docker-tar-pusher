import { createHash } from "node:crypto";
import { join } from "node:path";
import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer, Stream } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import { RegistryError } from "../errors/RegistryError.js";
import { UploadError } from "../errors/UploadError.js";
import type {
  Auth,
  ChunkMetaData,
  Headers,
  RegistryManifest,
} from "../types.js";
import { ContentTypes, RequestHeaders } from "../types.js";

export type DockerRegistryServiceConfig = {
  chunkSize: number;
  registryUrl: string;
  sslVerify: boolean;
  auth?: Auth;
};

class RegistryConfig extends Context.Service<
  RegistryConfig,
  DockerRegistryServiceConfig
>()("RegistryConfig") {}

const getChunkUploadHeaders = (start: number, length: number): Headers => ({
  [RequestHeaders.CONTENT_TYPE]: ContentTypes.APPLICATION_OCTET_STREAM,
  [RequestHeaders.CONTENT_LENGTH]: String(length),
  [RequestHeaders.CONTENT_RANGE]: `${start}-${start + length - 1}`,
});

const extractStatusCode = (e: unknown): number | undefined =>
  HttpClientError.isHttpClientError(e) && e.reason._tag === "StatusCodeError"
    ? e.reason.response.status
    : undefined;

const locationOf = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<string, Error> => {
  const location = response.headers["location"];
  return location
    ? Effect.succeed(new URL(location, response.request.url).toString())
    : Effect.fail(new Error("Registry response is missing a Location header"));
};

type ChunkState = {
  bytesRead: number;
  followUploadUrl: string;
  lastChunk: Uint8Array;
  lastHeaders: Headers;
};

export class RegistryService extends Context.Service<
  RegistryService,
  {
    readonly upload: (
      cwd: string,
      image: string,
      file: string,
    ) => Effect.Effect<ChunkMetaData, RegistryError | UploadError>;
    readonly pushManifest: (
      manifest: RegistryManifest,
      image: string,
      tag: string,
    ) => Effect.Effect<void, RegistryError>;
  }
>()("DockerRegistryService") {
  static readonly layer = Layer.effect(
    RegistryService,
    Effect.gen(function* () {
      const config = yield* RegistryConfig;
      const client = yield* HttpClient.HttpClient;
      const fs = yield* FileSystem.FileSystem;

      const initiateUpload = (
        image: string,
      ): Effect.Effect<string, RegistryError> => {
        const url = `${config.registryUrl}/v2/${image}/blobs/uploads/`;
        return client.post(url).pipe(
          Effect.flatMap((response) => locationOf(response)),
          Effect.mapError(
            (e) =>
              new RegistryError({
                message: `Failed to initiate upload for image: ${image}`,
                cause: e,
                statusCode: extractStatusCode(e),
                context: { url, image, operation: "initiate_upload" },
              }),
          ),
        );
      };

      const pushFileInChunks = (
        cwd: string,
        uploadUrl: string,
        file: string,
      ): Effect.Effect<ChunkMetaData, UploadError> => {
        const filePath = join(cwd, file);
        let bytesUploaded = 0;
        let totalBytes: number | undefined;
        return Effect.gen(function* () {
          const sha256 = createHash("sha256");
          const fileSize = Number((yield* fs.stat(filePath)).size);
          totalBytes = fileSize;
          const fileStream = fs.stream(filePath, {
            chunkSize: config.chunkSize,
          });

          const finalState = yield* fileStream.pipe(
            Stream.runFoldEffect(
              (): ChunkState => ({
                bytesRead: 0,
                followUploadUrl: uploadUrl,
                lastChunk: new Uint8Array(0),
                lastHeaders: {} as Headers,
              }),
              (state, chunk) =>
                Effect.gen(function* () {
                  const headers = getChunkUploadHeaders(
                    state.bytesRead,
                    chunk.length,
                  );
                  const bytesRead = state.bytesRead + chunk.length;
                  sha256.update(chunk);

                  if (bytesRead < fileSize) {
                    const request = HttpClientRequest.patch(
                      state.followUploadUrl,
                    ).pipe(
                      HttpClientRequest.setHeaders(headers),
                      HttpClientRequest.bodyUint8Array(chunk),
                    );
                    const response = yield* client.execute(request);
                    bytesUploaded = bytesRead;
                    return {
                      bytesRead,
                      followUploadUrl: yield* locationOf(response),
                      lastChunk: chunk,
                      lastHeaders: headers,
                    };
                  }

                  return {
                    bytesRead,
                    followUploadUrl: state.followUploadUrl,
                    lastChunk: chunk,
                    lastHeaders: headers,
                  };
                }),
            ),
          );

          const digest = `sha256:${sha256.digest("hex")}`;
          const finalUrl = new URL(finalState.followUploadUrl);
          finalUrl.searchParams.set("digest", digest);
          const finalRequest = HttpClientRequest.put(finalUrl).pipe(
            HttpClientRequest.setHeaders(finalState.lastHeaders),
            HttpClientRequest.bodyUint8Array(finalState.lastChunk),
          );
          yield* client.execute(finalRequest);

          return { digest, size: finalState.bytesRead };
        }).pipe(
          Effect.mapError(
            (e) =>
              new UploadError({
                message: `Failed to upload file: ${file}`,
                cause: e,
                statusCode: extractStatusCode(e),
                context: {
                  fileName: file,
                  uploadUrl,
                  bytesUploaded,
                  totalBytes,
                  operation: "chunk",
                },
              }),
          ),
        );
      };

      const upload = (
        cwd: string,
        image: string,
        file: string,
      ): Effect.Effect<ChunkMetaData, RegistryError | UploadError> =>
        Effect.gen(function* () {
          const uploadUrl = yield* initiateUpload(image);
          return yield* pushFileInChunks(cwd, uploadUrl, file);
        });

      const pushManifest = (
        manifest: RegistryManifest,
        image: string,
        tag: string,
      ): Effect.Effect<void, RegistryError> => {
        const url = `${config.registryUrl}/v2/${image}/manifests/${tag}`;
        const request = HttpClientRequest.put(url).pipe(
          HttpClientRequest.bodyText(
            JSON.stringify(manifest),
            ContentTypes.APPLICATION_MANIFEST,
          ),
        );
        return client.execute(request).pipe(
          Effect.asVoid,
          Effect.mapError(
            (e) =>
              new RegistryError({
                message: `Failed to push manifest for ${image}:${tag}`,
                cause: e,
                statusCode: extractStatusCode(e),
                context: { url, image, tag, operation: "push_manifest" },
              }),
          ),
        );
      };

      return RegistryService.of({ upload, pushManifest });
    }),
  );
}

export const makeRegistryServiceLayer = (
  config: DockerRegistryServiceConfig,
): Layer.Layer<RegistryService> => {
  const configLayer = Layer.succeed(RegistryConfig, config);

  const agentLayer = NodeHttpClient.layerAgentOptions({
    rejectUnauthorized: config.sslVerify,
    requestCert: true,
  });

  const baseHttpLayer = NodeHttpClient.layerNodeHttpNoAgent.pipe(
    Layer.provide(agentLayer),
  );

  const httpLayer = Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* () {
      const baseClient = yield* HttpClient.HttpClient;
      const { auth } = config;
      const client = auth
        ? baseClient.pipe(
            HttpClient.mapRequest(
              HttpClientRequest.basicAuth(auth.username, auth.password),
            ),
          )
        : baseClient;
      return client.pipe(
        HttpClient.followRedirects(),
        HttpClient.filterStatusOk,
      );
    }),
  ).pipe(Layer.provide(baseHttpLayer));

  return RegistryService.layer.pipe(
    Layer.provide(Layer.mergeAll(httpLayer, NodeFileSystem.layer, configLayer)),
  );
};
