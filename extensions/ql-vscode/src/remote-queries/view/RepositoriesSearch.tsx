import * as React from 'react';
import { ChangeEvent } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

interface RepositoriesSearchProps {
  filterValue: string;
  setFilterValue: (value: string) => void;
}

const RepositoriesSearch = ({ filterValue, setFilterValue }: RepositoriesSearchProps) => {
  return <>
    <VSCodeTextField
      placeholder='Filter by repository owner/name'
      size='150'
      ariaLabel="Repository search"
      name="repository-search"
      value={filterValue}
      onInput={(e: ChangeEvent) => setFilterValue((e.target as HTMLInputElement).value)}
    >
      <span slot="start" className="codicon codicon-search"></span>
    </VSCodeTextField>
  </>;
};

export default RepositoriesSearch;
