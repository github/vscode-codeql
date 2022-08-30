export type WebviewDefinition = {
  component: JSX.Element,
  loadedMessage: 'compareViewLoaded' | 'remoteQueryLoaded' | 'resultViewLoaded';
}
