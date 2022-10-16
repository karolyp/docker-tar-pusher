# docker-tar-pusher

[![build](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml/badge.svg)](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml)

With this library you can push tar Docker images directly to a Docker registry without the need of having them loaded into the Docker Engine, re-tagging and pushing.

The library uses [chunked upload](https://docs.docker.com/registry/spec/api/#pushing-an-image) to push the layers.

Supports HTTP Basic auth.

## How to use

First, you have to create a configuration object with the following properties:

- registryUrl: address of the registry
- tarball: absolute path to tar file
- chunkSize (optional): size of chunks, defaults to 10 MiB (10 \* 1024 \* 1024)
- logger (optional): specify custom applicationLogger, defaults to console.log
- sslVerify (optional): should reject invalid TLS certificates, defaults to true
- auth (optional): HTTP Basic auth containing the username and password, defaults to empty

### Clean-up

After a successful upload, the library will take care about cleaning up the temporary files that have been created
during the process.
However, you might want to call this clean-up function on in one of your shutdown hooks in order to remove
any leftovers in case of a shutdown.

## Examples

### Quickstart

```typescript
import {DockerTarPusher, DockerTarPusherOptions} from 'docker-tar-pusher';

const options: DockerTarPusherOptions = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar'
};
const dockerTarPusher = new DockerTarPusher(options);

await dockerTarPusher.pushToRegistry();
```

### Complete example with custom logger

```typescript
import {DockerTarPusher, DockerTarPusherOptions, Logger} from 'docker-tar-pusher';

const myLogger: Logger = {
  error: (msg: string): void => {
    console.log(`[ERROR] ${msg}`);
  },
  warn: (msg: string): void => {
    console.log(`[WARN] ${msg}`);
  },
  info: (msg: string): void => {
    console.log(`[INFO] ${msg}`);
  },
  debug: (msg: string): void => {
    console.log(`[DEBUG] ${msg}`);
  }
};

const options: DockerTarPusherOptions = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar',
  chunkSize: 8 * 1024 * 1024,
  applicationLogger: myLogger,
  sslVerify: false,
  auth: {
    username: 'testuser',
    password: 'testpassword'
  }
};
const dockerTarPusher = new DockerTarPusher(options);

// Attaching clean-up logic to shutdown hook
process.on('SIGINT', () => {
  dockerTarPusher.cleanUp();
});

(async () => {
  await dockerTarPusher.pushToRegistry();
})();
```

## License

[MIT](LICENSE)

Inspired by [dockerregistrypusher](https://github.com/Razikus/dockerregistrypusher)
