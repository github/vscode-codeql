import * as React from 'react';
import { ChangeEvent } from 'react';
import { TextInput } from '@primer/react';
import { SearchIcon } from '@primer/octicons-react';

interface RepositoriesSearchProps {
  filterValue: string;
  setFilterValue: (value: string) => void;
}

const RepositoriesSearch = ({ filterValue, setFilterValue }: RepositoriesSearchProps) => {
  return <>
    <TextInput
      block
      sx={{
        backgroundColor: 'var(--vscode-editor-background);',
        color: 'var(--vscode-editor-foreground);',
        width: 'calc(100% - 14px)',
      }}
      className="vscode-codeql__repositories-search"
      leadingVisual={SearchIcon}
      aria-label="Repository search"
      name="repository-search"
      placeholder="Filter by repository owner/name"
      value={filterValue}
      onChange={(e: ChangeEvent) => setFilterValue((e.target as HTMLInputElement).value)}
    />
  </>;
};

export default RepositoriesSearch;
