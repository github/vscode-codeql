import { useCallback } from "react";
import { styled } from "styled-components";
import {
  VscodeOption,
  VscodeSingleSelect,
} from "@vscode-elements/react-elements";
import { Codicon } from "../common";
import { FilterKey } from "../../variant-analysis/shared/variant-analysis-filter-sort";

const Dropdown = styled(VscodeSingleSelect)`
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
    <Dropdown value={value} onChange={handleInput} className={className}>
      <Codicon name="list-filter" label="Filter..." slot="indicator" />
      <VscodeOption value={FilterKey.All}>All</VscodeOption>
      <VscodeOption value={FilterKey.WithResults}>With results</VscodeOption>
    </Dropdown>
  );
};
