import { useCallback } from "react";
import { styled } from "styled-components";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

const Dropdown = styled(VSCodeDropdown)`
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
    <Dropdown value={value} onInput={handleInput} className={className}>
      <Codicon name="table" label="Result format..." slot="indicator" />
      <VSCodeOption value={ResultFormat.Alerts}>
        {ResultFormat.Alerts}
      </VSCodeOption>
      <VSCodeOption value={ResultFormat.RawResults}>
        {ResultFormat.RawResults}
      </VSCodeOption>
    </Dropdown>
  );
};
