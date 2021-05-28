# docker-tar-pusher

With this library you will be able to push tar files directly to Docker registry.

Example:

```javascript
import { DockerTarPusher } from 'docker-tar-pusher';
const dockerTarPusher = new DockerTarPusher({ registryUrl: '<registry url>', tarball: '<tarball>' });
dockerTarPusher.pushToRegistry();
```

Inspired by [dockerregistrypusher](https://github.com/Razikus/dockerregistrypusher)
