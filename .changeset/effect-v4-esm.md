---
"docker-tar-pusher": major
---

Migrate to Effect v4 and ship as ESM only.

- Replace axios and valibot with Effect (`HttpClient`, `Schema`).
- The `DockerTarPusher` class and its `cleanUp()` method are removed. Use `pushToRegistry(options)` with `makeDockerTarPusherLayer(options)` instead; temporary files are cleaned up automatically when the effect finishes. Run the program with `NodeRuntime.runMain` so Ctrl-C and `SIGTERM` also clean them up.
- New exports: `pushToRegistry`, `makeDockerTarPusherLayer`, `RegistryService`, `makeRegistryServiceLayer`, `ProgressEvent`, `ProgressCallback`.
- Errors are tagged (`ManifestError`, `RegistryError`, `UploadError`) and carry their `cause`. Invalid options fail with `SchemaError`, file system failures outside the tarball with `PlatformError`.
- Basic auth is sent only to the registry origin, not to upload locations on other hosts.
- `chunkSize` must be a positive integer.
- Repo tags with a registry host (`localhost:5000/app:1.0`) are pushed as `app:1.0`.
- Package is ESM only (`"type": "module"`) and requires Node 22.12 or later (`engines`), the first version where `require()` of ESM works without a flag.
