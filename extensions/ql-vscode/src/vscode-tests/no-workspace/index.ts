import 'source-map-support/register';
import 'vscode-test';
import * as sinonChai from 'sinon-chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'chai/register-should';

import { runTestsInDirectory } from '../index-template';

chai.use(chaiAsPromised);
chai.use(sinonChai);

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
