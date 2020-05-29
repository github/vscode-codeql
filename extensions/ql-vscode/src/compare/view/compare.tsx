import * as React from 'react';
import * as Rdom from 'react-dom';

interface Props {
  /**/
}

export function App(props: Props): JSX.Element {
  return (
    <div>Compare View!</div>
  );
}

Rdom.render(
  <App />,
  document.getElementById('root')
);
