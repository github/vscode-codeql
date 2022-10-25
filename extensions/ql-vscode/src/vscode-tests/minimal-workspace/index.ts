import 'source-map-support/register';

import { runTestsInDirectory } from '../index-template';

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}

process.addListener('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.message === 'Canceled') {
    console.log('Cancellation requested after the test has ended.');
    process.exit(0);
  } else {
    fail(String(reason));
  }
});
