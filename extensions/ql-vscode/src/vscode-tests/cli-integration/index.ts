import "source-map-support/register";
import { runTestsInDirectory } from "../index-template";
import "mocha";
import * as sinonChai from "sinon-chai";
import * as chai from "chai";
import "chai/register-should";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.use(sinonChai);

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname, true);
}
