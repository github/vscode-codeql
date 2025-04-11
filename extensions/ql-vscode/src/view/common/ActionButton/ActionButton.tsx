import styles from "./ActionButton.module.css";

// This is needed because vscode-elements/elements does not implement
// the same styles for icon buttons as vscode/webview-ui-toolkit
export const ActionButton = (props: React.ComponentProps<"button">) => (
  <button type="button" {...props} className={styles.actionButton}>
    {props.children}
  </button>
);
