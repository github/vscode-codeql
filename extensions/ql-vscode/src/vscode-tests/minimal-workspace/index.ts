import "source-map-support/register";
import "chai/register-should";

import { runTestsInDirectory } from "../index-template";

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
