import DockerTarPusher from './DockerTarPusher';
import { DockerTarPusherOptions } from './types';

const options: DockerTarPusherOptions = {
  registryUrl: 'http://localhost:5000',
  tarball: 'tars/hello.tar',
  auth: {
    username: 'testuser',
    password: 'testpassword'
  },
  quiet: false
};

new DockerTarPusher(options).pushToRegistry();

export { DockerTarPusher };
