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
  onClear: () => void;
};

export const LanguageFilter = ({
  onChange,
  onClear,
}: LanguageFilterProps): JSX.Element => {
  const handleInput = React.useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      if (target.value === "all") {
        onClear();
      } else {
        onChange(target.value as QueryLanguage);
      }
    },
    [onChange, onClear],
  );

  return (
    <Dropdown onInput={handleInput}>
      <>
        <VSCodeOption key="0" value="all">
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
