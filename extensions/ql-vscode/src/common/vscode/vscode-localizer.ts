import { env } from "vscode";
import { Localizer } from "../localizer";

export class VSCodeLocalizer extends Localizer {
  protected locales(): string | string[] | undefined {
    return env.language;
  }
}
