---
"docker-tar-pusher": major
---

Migrate to Effect v4 and ship as ESM only.

- Replace axios and valibot with Effect (`HttpClient`, `Schema`).
- New API: `pushToRegistry`, `makeDockerTarPusherLayer`, `RegistryService`, `makeRegistryServiceLayer`.
- Errors are now tagged (`ManifestError`, `RegistryError`, `UploadError`).
- Remove the `buildManifest` export.
- Package is ESM only (`"type": "module"`); `require()` is not supported on Node older than 22.12.
