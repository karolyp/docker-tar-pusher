# docker-tar-pusher

[![build](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml/badge.svg)](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml)

With this library you can push tar Docker images directly to a Docker registry without the need of having them loaded
into the Docker Engine, re-tagging and pushing.

The library uses [chunked upload](https://docs.docker.com/registry/spec/api/#pushing-an-image) to push the layers.

Supports HTTP Basic auth.

## How to use

The library is built on [Effect](https://effect.website) and is ESM only.

Create the layer from a configuration object, then run `pushToRegistry` with that layer provided.

Layer options (`makeDockerTarPusherLayer`):

- registryUrl: address of the registry
- tarball: absolute path to tar file
- chunkSize (optional): size of chunks, defaults to 10 MiB (10 \* 1024 \* 1024)
- sslVerify (optional): should reject invalid TLS certificates, defaults to true
- auth (optional): HTTP Basic auth containing the username and password, defaults to empty
- image (optional): image name and version, defaults to the repo tags found in the tarball

Push options (`pushToRegistry`):

- tarball: absolute path to tar file
- image (optional): image name and version, defaults to the repo tags found in the tarball
- onProgress (optional): callback invoked with a `ProgressEvent` for each layer, the config and the manifest

The temporary files created while extracting the tarball are removed when the effect finishes, even on failure or interruption.

Errors are tagged and can be handled with `Effect.catchTag`: `ManifestError`, `RegistryError` and `UploadError`.

## Examples

### Quickstart

```typescript
import { Effect } from 'effect';
import { makeDockerTarPusherLayer, pushToRegistry } from 'docker-tar-pusher';

const options = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar'
};

await Effect.runPromise(
  pushToRegistry(options).pipe(Effect.provide(makeDockerTarPusherLayer(options)))
);
```

### Complete example

```typescript
import { Effect } from 'effect';
import { makeDockerTarPusherLayer, pushToRegistry } from 'docker-tar-pusher';

const options = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar',
  chunkSize: 8 * 1024 * 1024,
  sslVerify: false,
  auth: {
    username: 'testuser',
    password: 'testpassword'
  },
  image: {
    name: 'my-image',
    version: '1.2.3'
  },
  onProgress: ({ type, current, total, item }) => {
    console.log(`[${type}] ${current}/${total} ${item}`);
  }
};

const program = pushToRegistry(options).pipe(
  Effect.catchTag('RegistryError', (e) => Effect.logError(`${e.message} (${e.statusCode})`)),
  Effect.provide(makeDockerTarPusherLayer(options))
);

await Effect.runPromise(program);
```

## License

[MIT](LICENSE)

Inspired by [dockerregistrypusher](https://github.com/Razikus/dockerregistrypusher)
