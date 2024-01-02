import { useCallback } from "react";
import { styled } from "styled-components";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";
import { FilterKey } from "../../variant-analysis/shared/variant-analysis-filter-sort";

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
`;

type Props = {
  value: FilterKey;
  onChange: (value: FilterKey) => void;

  className?: string;
};

export const RepositoriesFilter = ({ value, onChange, className }: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as FilterKey);
    },
    [onChange],
  );

  return (
    <Dropdown value={value} onInput={handleInput} className={className}>
      <Codicon name="list-filter" label="Filter..." slot="indicator" />
      <VSCodeOption value={FilterKey.All}>All</VSCodeOption>
      <VSCodeOption value={FilterKey.WithResults}>With results</VSCodeOption>
    </Dropdown>
  );
};
