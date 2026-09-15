import { runGameStateWorker, writeErrorLog } from './runtime.js';

const controller = new AbortController();
const stop = (): void => controller.abort();

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await runGameStateWorker(undefined, controller.signal);
} catch (error) {
  writeErrorLog('game-state-worker', error);
  process.exitCode = 1;
}
