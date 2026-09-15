import { runBoxScoreWorker, writeErrorLog } from './runtime.js';

const controller = new AbortController();
const stop = (): void => controller.abort();

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await runBoxScoreWorker(undefined, controller.signal);
} catch (error) {
  writeErrorLog('box-score-worker', error);
  process.exitCode = 1;
}
