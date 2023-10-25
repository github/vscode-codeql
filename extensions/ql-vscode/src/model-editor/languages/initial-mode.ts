import { QueryLanguage } from "../../common/query-language";
import { INITIAL_MODE, Mode } from "../shared/mode";

export function getInitialMode(language: QueryLanguage): Mode {
  if (language === QueryLanguage.Ruby) {
    return Mode.Framework;
  }

  return INITIAL_MODE;
}
