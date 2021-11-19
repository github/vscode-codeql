import * as React from 'react';
import * as Rdom from 'react-dom';

import { vscode } from '../../view/vscode-api';


export function RemoteQueries(_: Record<string, never>): JSX.Element {
  return <div>RemoteQueries</div>;
}

Rdom.render(
  <RemoteQueries />,
  document.getElementById('root'),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: 'remoteQueryLoaded' })
);
