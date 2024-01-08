import { env } from "vscode";
import type { EnvironmentContext } from "../app";

export class AppEnvironmentContext implements EnvironmentContext {
  public get language(): string {
    return env.language;
  }
}
