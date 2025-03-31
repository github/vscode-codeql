// eslint-disable-next-line import/no-namespace -- We need a type of JSDOM so we can't use named imports.
import * as JSDOM from "jsdom";
import type {
  EnvironmentContext,
  JestEnvironmentConfig,
} from "@jest/environment";
import BaseEnv from "@jest/environment-jsdom-abstract";

export default class JSDOMEnvironment extends BaseEnv {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context, JSDOM);
  }
}

export const TestEnvironment = JSDOMEnvironment;
