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

export type LanguageFilterProps = {
  onChange: (value: QueryLanguage) => void;
};

export const LanguageFilter = ({
  onChange,
}: LanguageFilterProps): JSX.Element => {
  const handleInput = React.useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as QueryLanguage);
    },
    [onChange],
  );

  return (
    <Dropdown onInput={handleInput}>
      <>
        <VSCodeOption key="0" value="0">
          All languages
        </VSCodeOption>
        {languages.map((language, index) => (
          <VSCodeOption key={index} value={language}>
            {getLanguageDisplayName(language)}
          </VSCodeOption>
        ))}
      </>
    </Dropdown>
  );
};
