import { DockerTarPusher, Logger } from '../src';
import chalk from 'chalk';

const myLogger: Logger = {
  error: (msg) => {
    console.log(`${chalk.red('[ERROR]')} ${msg}`);
  },
  warn: (msg) => {
    console.log(`${chalk.redBright('[WARN]')} ${msg}`);
  },
  info: (msg) => {
    console.log(`${chalk.green('[INFO]')} ${msg}`);
  },
  debug: (msg) => {
    console.log(`${chalk.blue('[DEBUG]')} ${msg}`);
  }
};

(async () => {
  const dtps = ['/home/kpakozdi/Projects/docker-tar-pusher/busybox.tar'].map(
    (tarball) =>
      new DockerTarPusher({
        registryUrl: 'http://localhost:5000',
        tarball,
        logger: myLogger
      })
  );
  process.on('SIGINT', () => {
    dtps.forEach((dtp) => dtp.cleanUp());
  });
  const promises = dtps.map((dtp) => {
    return new Promise((res, rej) => {
      dtp.pushToRegistry().then(res).catch(rej);
    });
  });

  await Promise.all(promises);
})();
