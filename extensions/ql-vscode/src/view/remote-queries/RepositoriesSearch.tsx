import * as React from "react";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";

interface RepositoriesSearchProps {
  filterValue: string;
  setFilterValue: (value: string) => void;
}

const RepositoriesSearch = ({
  filterValue,
  setFilterValue,
}: RepositoriesSearchProps) => {
  return (
    <>
      <VSCodeTextField
        style={{ width: "100%" }}
        placeholder="Filter by repository owner/name"
        ariaLabel="Repository search"
        name="repository-search"
        value={filterValue}
        onInput={(e: InputEvent) =>
          setFilterValue((e.target as HTMLInputElement).value)
        }
      >
        <span slot="start" className="codicon codicon-search"></span>
      </VSCodeTextField>
    </>
  );
};

export default RepositoriesSearch;
