# docker-tar-pusher

With this library you will be able to push tar files directly to Docker registry without the need of loading it to the Docker Engine, retagging and pushing.

## Configuration

- registryUrl: address of the registry
- tarball: absolute path to tar file
- chunkSize (optional): size of chunks, defaults to 10 MB (10 \* 1024 \* 1024)
- quiet (optional): whether to log or not, defaults to true

## Example

```javascript
const configuration = {
  registryUrl: 'http://localhost:5000',
  tarball: 'path/to/file.tar',
  chunkSize: 8 * 1024 * 1024,
  quiet: false
};
const dockerTarPusher = new DockerTarPusher(configuration);
await dockerTarPusher.pushToRegistry();
```

## License

[MIT](LICENSE)

Inspired by [dockerregistrypusher](https://github.com/Razikus/dockerregistrypusher)
