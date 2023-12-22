import { styled } from "styled-components";
import { pluralize } from "../../common/word";
import { DataGridCell, DataGridRow } from "../common/DataGrid";

const HiddenMethodsCell = styled(DataGridCell)`
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
    <DataGridRow>
      <HiddenMethodsCell gridColumn="span 6">
        {someMethodsAreVisible && "And "}
        {pluralize(numHiddenMethods, "method", "methods")} modeled in other
        CodeQL packs
      </HiddenMethodsCell>
    </DataGridRow>
  );
}
