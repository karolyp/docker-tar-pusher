import { LoggerConfig } from './types';

export default class Logger {
  constructor(private config: LoggerConfig) {}

  public log(message: string): void {
    if (!this.config.quiet) {
      console.log(message);
    }
  }
}
