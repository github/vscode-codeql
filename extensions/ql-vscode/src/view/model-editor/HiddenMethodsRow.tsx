import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { styled } from "styled-components";

const HiddenMethodsCell = styled(VSCodeDataGridCell)`
  text-align: center;
`;

interface Props {
  numHiddenMethods: number;
  someMethodsAreVisible: boolean;
}

export function HiddenMethodsRow({
  numHiddenMethods,
  someMethodsAreVisible,
}: Props) {
  if (numHiddenMethods === 0) {
    return null;
  }

  return (
    <VSCodeDataGridRow>
      <HiddenMethodsCell gridColumn="span 5">
        {someMethodsAreVisible && "And "}
        {numHiddenMethods} methods modeled in other CodeQL packs
      </HiddenMethodsCell>
    </VSCodeDataGridRow>
  );
}
