import "source-map-support/register";
import * as sinonChai from "sinon-chai";
import * as chai from "chai";
import "chai/register-should";
import * as chaiAsPromised from "chai-as-promised";

import { runTestsInDirectory } from "../index-template";

chai.use(chaiAsPromised);
chai.use(sinonChai);

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
