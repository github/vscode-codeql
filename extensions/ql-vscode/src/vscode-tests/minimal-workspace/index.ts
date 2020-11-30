import { runTestsInDirectory } from '../index-template';

import * as sinonChai from 'sinon-chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
chai.use(sinonChai);


export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
