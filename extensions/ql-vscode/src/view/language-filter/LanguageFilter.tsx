import * as React from "react";
import {
  QueryLanguage,
  getLanguageDisplayName,
} from "../../common/query-language";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { styled } from "styled-components";

const languages = Object.values(QueryLanguage);

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
  z-index: 9999;
`;

export const LanguageFilter = (): JSX.Element => {
  return (
    <Dropdown>
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
    </Dropdown>
  );
};
