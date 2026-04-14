import {
  alertExtrasClassName,
  toggleDiagnosticsClassName,
} from "./result-table-utils";

interface Props {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SelectionFilterCheckbox({
  checked,
  onChange,
}: Props): React.JSX.Element {
  return (
    <div className={alertExtrasClassName}>
      <div className={toggleDiagnosticsClassName}>
        <input
          type="checkbox"
          id="restrict-to-selection"
          name="restrict-to-selection"
          onChange={onChange}
          checked={checked}
        />
        <label htmlFor="restrict-to-selection">
          Filter results to current file or selection
        </label>
      </div>
    </div>
  );
}
