import * as React from 'react';

const Badge = ({ text }: { text: string }) => (
  <span className="vscode-codeql__badge-container">
    <span className="vscode-codeql__badge">{text}</span>
  </span>
);

export default Badge;
