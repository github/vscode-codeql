import 'source-map-support/register';
import 'vscode-test';
import sinonChai from 'sinon-chai';
import * as chai from 'chai';
import 'chai/register-should';
import chaiAsPromised from 'chai-as-promised';

import { runTestsInDirectory } from '../index-template';

chai.use(chaiAsPromised);
chai.use(sinonChai);

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
