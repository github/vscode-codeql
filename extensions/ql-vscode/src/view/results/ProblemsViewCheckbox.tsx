import { ALERTS_TABLE_NAME } from "../../common/interface-types";
import {
  alertExtrasClassName,
  toggleDiagnosticsClassName,
} from "./result-table-utils";

interface Props {
  selectedTable: string;
  problemsViewSelected: boolean;
  handleCheckboxChanged: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProblemsViewCheckbox(props: Props): React.JSX.Element | null {
  const { selectedTable, problemsViewSelected, handleCheckboxChanged } = props;

  if (selectedTable !== ALERTS_TABLE_NAME) {
    return null;
  }
  return (
    <div className={alertExtrasClassName}>
      <div className={toggleDiagnosticsClassName}>
        <input
          type="checkbox"
          id="toggle-diagnostics"
          name="toggle-diagnostics"
          onChange={handleCheckboxChanged}
          checked={problemsViewSelected}
        />
        <label htmlFor="toggle-diagnostics">
          Show results in Problems view
        </label>
      </div>
    </div>
  );
}
