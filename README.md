# docker-tar-pusher

[![build](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml/badge.svg)](https://github.com/karolyp/docker-tar-pusher/actions/workflows/node.js.yml)

With this library you can push Docker image in tar format, directly to a Docker registry without the need of loading it to the Docker Engine, retagging and pushing.

## How to use

First, you have create a configuration object which can contain the following properties:

- registryUrl: address of the registry
- tarball: absolute path to tar file
- chunkSize (optional): size of chunks, defaults to 10 MiB (10 \* 1024 \* 1024)
- quiet (optional): whether to log or not, defaults to true
- sslVerify (optional): should reject invalid TLS certificates, defaults to true
- auth (optional): HTTP Basic auth containing the username and password, defaults to empty

## Example

```typescript
const options: DockerTarPusherOptions = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar',
  chunkSize: 8 * 1024 * 1024,
  quiet: false,
  sslVerify: false,
  auth: {
    username: 'testuser',
    password: 'testpassword'
  }
};
const dockerTarPusher = new DockerTarPusher(options);
await dockerTarPusher.pushToRegistry();
```

## License

[MIT](LICENSE)

Inspired by [dockerregistrypusher](https://github.com/Razikus/dockerregistrypusher)
