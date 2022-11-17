import * as React from "react";
import { useCallback } from "react";
import styled from "styled-components";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";

const TextField = styled(VSCodeTextField)`
  width: 100%;
`;

type Props = {
  value: string;
  onChange: (value: string) => void;

  className?: string;
};

export const RepositoriesSearch = ({ value, onChange, className }: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLInputElement;

      onChange(target.value);
    },
    [onChange],
  );

  return (
    <TextField
      placeholder="Filter by repository owner/name"
      value={value}
      onInput={handleInput}
      className={className}
    >
      <Codicon name="search" label="Search..." slot="start" />
    </TextField>
  );
};
