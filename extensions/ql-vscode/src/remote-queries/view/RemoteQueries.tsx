import * as React from 'react';
import * as Rdom from 'react-dom';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';

export function RemoteQueries(_: Record<string, never>): JSX.Element {
  return <div>
    {/* TODO: Use inputs instead of hardcoded text */}
    <h1>Empty Block</h1>
    <p>72 results in 13 repositories (0.6 seconds), 24 Jun at 6:32pm</p>
    {/* TODO: Figure out how to use dark/light icons */}
    <p>📝 example.ql ⏩ query</p>

    <h2>Summary: 13 repositories affected</h2> <a href="todo">⏬ Download all</a>
    {/* TODO: maybe make list items into components */}
    <ul>{octicons.listUnordered} dsp-testing/qc-demo1 <span>35</span> <a href="todo">⏬ 12.3mb</a> </ul>
    <ul>{octicons.chevronRight} dsp-testing/qc-demo2 <span>27</span> <span>⭕</span></ul>

    <a href="todo"> View all </a>

  </div>;
}

Rdom.render(
  <RemoteQueries />,
  document.getElementById('root'),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: 'remoteQueryLoaded' })
);
