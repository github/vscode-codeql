import { useCallback } from "react";
import { styled } from "styled-components";
import {
  VscodeOption,
  VscodeSingleSelect,
} from "@vscode-elements/react-elements";
import { Codicon } from "../common";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

const Dropdown = styled(VscodeSingleSelect)`
  width: 100%;
`;

type Props = {
  value: ResultFormat;
  onChange: (value: ResultFormat) => void;

  className?: string;
};

export const RepositoriesResultFormat = ({
  value,
  onChange,
  className,
}: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as ResultFormat);
    },
    [onChange],
  );

  return (
    <Dropdown value={value} onChange={handleInput} className={className}>
      <Codicon name="table" label="Result format..." slot="indicator" />
      <VscodeOption value={ResultFormat.Alerts}>
        {ResultFormat.Alerts}
      </VscodeOption>
      <VscodeOption value={ResultFormat.RawResults}>
        {ResultFormat.RawResults}
      </VscodeOption>
    </Dropdown>
  );
};
