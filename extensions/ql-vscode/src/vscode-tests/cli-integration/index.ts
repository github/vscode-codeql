import 'mocha';
import 'sinon-chai';
import { runTestsInDirectory } from '../index-template';

// The simple database used throughout the tests
export function run(): Promise<void> {
  return runTestsInDirectory(__dirname, true);
}
