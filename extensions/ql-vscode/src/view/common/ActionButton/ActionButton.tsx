import "./ActionButton.css";

// This is needed because vscode-elements/elements does not implement
// the same styles for icon buttons as vscode/webview-ui-toolkit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ActionButton = (props: any) => (
  <button type="button" {...props} className="vscode-action-button">
    {props.children}
  </button>
);
