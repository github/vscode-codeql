import * as React from "react";
import { useCallback, useEffect } from "react";
import { styled } from "styled-components";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";

import type { ModeledMethod } from "../../data-extensions-editor/modeled-method";

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
`;

type Props = {
  kinds: Array<ModeledMethod["kind"]>;

  value: ModeledMethod["kind"] | undefined;
  onChange: (value: ModeledMethod["kind"]) => void;
};

export const KindInput = ({ kinds, value, onChange }: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as ModeledMethod["kind"]);
    },
    [onChange],
  );

  useEffect(() => {
    if (value === undefined && kinds.length > 0) {
      onChange(kinds[0]);
    }

    if (value !== undefined && !kinds.includes(value)) {
      onChange(kinds[0]);
    }
  }, [value, kinds, onChange]);

  return (
    <Dropdown value={value} onInput={handleInput}>
      {kinds.map((kind) => (
        <VSCodeOption key={kind} value={kind}>
          {kind}
        </VSCodeOption>
      ))}
    </Dropdown>
  );
};
