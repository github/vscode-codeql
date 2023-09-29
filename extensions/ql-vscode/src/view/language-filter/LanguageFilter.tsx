import * as React from "react";
import {
  QueryLanguage,
  getLanguageDisplayName,
} from "../../common/query-language";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";

const languages = Object.values(QueryLanguage);

export const LanguageFilter = (): JSX.Element => {
  return (
    <VSCodeDropdown>
      <>
        <VSCodeOption key="0" value="0">
          All languages
        </VSCodeOption>
        {languages.map((language, index) => (
          <VSCodeOption key={index} value={index.toString()}>
            {getLanguageDisplayName(language)}
          </VSCodeOption>
        ))}
      </>
    </VSCodeDropdown>
  );
};
