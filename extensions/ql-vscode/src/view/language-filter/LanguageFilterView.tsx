import * as React from "react";
import { LanguageFilter } from "./LanguageFilter";
import { vscode } from "../vscode-api";
import { QueryLanguage } from "../../common/query-language";

export function LanguageFilterView(): JSX.Element {
  React.useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        // Nothing to do yet.
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  const [language, setLanguage] = React.useState<QueryLanguage | "all">("all");

  const onChange = (language: QueryLanguage) => {
    setLanguage(language);
    vscode.postMessage({
      t: "setLanguageFilter",
      language,
    });
  };

  const onClear = () => {
    setLanguage("all");
    vscode.postMessage({
      t: "clearLanguageFilter",
    });
  };

  return (
    <LanguageFilter onChange={onChange} onClear={onClear} language={language} />
  );
}
