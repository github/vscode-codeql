import { env } from "vscode";
import { EnvironmentContext } from "../app";

export class AppEnvironmentContext implements EnvironmentContext {
  public get language(): string {
    return env.language;
  }
}
