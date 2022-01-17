import * as React from 'react';
import * as octicons from '../../view/octicons';

const DownloadButton = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <a className="vscode-codeql__download-button"
    onClick={onClick}>
    {octicons.download}{text}
  </a>
);

export default DownloadButton;
