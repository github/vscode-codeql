import { useCallback } from "react";
import { styled } from "styled-components";
import {
  VscodeOption,
  VscodeSingleSelect,
} from "@vscode-elements/react-elements";
import { SortKey } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { Codicon } from "../common";

const Dropdown = styled(VscodeSingleSelect)`
  width: 100%;
`;

type Props = {
  value: SortKey;
  onChange: (value: SortKey) => void;

  className?: string;
};

export const RepositoriesSort = ({ value, onChange, className }: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as SortKey);
    },
    [onChange],
  );

  return (
    <Dropdown value={value} onChange={handleInput} className={className}>
      <Codicon name="sort-precedence" label="Sort..." slot="indicator" />
      <VscodeOption value={SortKey.Alphabetically}>Alphabetically</VscodeOption>
      <VscodeOption value={SortKey.NumberOfResults}>
        Number of results
      </VscodeOption>
      <VscodeOption value={SortKey.Popularity}>Popularity</VscodeOption>
    </Dropdown>
  );
};
