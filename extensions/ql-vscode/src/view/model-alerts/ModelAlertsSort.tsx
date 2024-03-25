import { useCallback } from "react";
import { styled } from "styled-components";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { SortKey } from "../../model-editor/shared/model-alerts-filter-sort";
import { Codicon } from "../common";

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
`;

type Props = {
  value: SortKey;
  onChange: (value: SortKey) => void;

  className?: string;
};

export const ModelAlertsSort = ({ value, onChange, className }: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as SortKey);
    },
    [onChange],
  );

  return (
    <Dropdown value={value} onInput={handleInput} className={className}>
      <Codicon name="sort-precedence" label="Sort..." slot="indicator" />
      <VSCodeOption value={SortKey.Alphabetically}>Alphabetically</VSCodeOption>
      <VSCodeOption value={SortKey.NumberOfResults}>
        Number of results
      </VSCodeOption>
    </Dropdown>
  );
};
