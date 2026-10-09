---
"docker-tar-pusher": major
---

Migrate to Effect v4 and ship as ESM only.

- Replace axios and valibot with Effect (`HttpClient`, `Schema`).
- The `DockerTarPusher` class and its `cleanUp()` method are removed. Use `pushToRegistry(options)` with `makeDockerTarPusherLayer(options)` instead; temporary files are cleaned up automatically when the effect finishes.
- New exports: `pushToRegistry`, `makeDockerTarPusherLayer`, `RegistryService`, `makeRegistryServiceLayer`, `ProgressEvent`, `ProgressCallback`.
- Errors are tagged (`ManifestError`, `RegistryError`, `UploadError`) and carry their `cause`.
- `chunkSize` must be a positive integer.
- Repo tags with a registry host (`localhost:5000/app:1.0`) are pushed as `app:1.0`.
- Package is ESM only (`"type": "module"`); `require()` is not supported on Node older than 22.12.
