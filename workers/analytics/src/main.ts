import { runAnalyticsWorker, writeErrorLog } from './runtime.js';

const controller = new AbortController();
const stop = (): void => controller.abort();

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await runAnalyticsWorker(undefined, controller.signal);
} catch (error) {
  writeErrorLog('analytics-worker', error);
  process.exitCode = 1;
}
