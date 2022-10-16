import { Logger } from '../types';

const noOp = (): void => {
  // no-op
};

export const noOpLogger: Logger = {
  info: noOp,
  debug: noOp,
  warn: noOp,
  error: noOp
};

export const consoleLogger: Logger = {
  info: console.log,
  debug: console.log,
  warn: console.error,
  error: console.error
};

export let logger: Logger = noOpLogger;

export const setApplicationLogger = (_logger: Logger): void => {
  logger = _logger;
};
