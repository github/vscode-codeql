import 'source-map-support/register';
import 'vscode-test';
import * as sinonChai from 'sinon-chai';
import * as chai from 'chai';
import 'chai/register-should';
import * as chaiAsPromised from 'chai-as-promised';

import { runTestsInDirectory } from '../index-template';

chai.use(chaiAsPromised);
chai.use(sinonChai);

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
