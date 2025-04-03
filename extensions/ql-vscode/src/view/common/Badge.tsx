import { VscodeBadge } from "@vscode-elements/react-elements";

// This applies the counter variant by default so the border-radius attribute is set
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Badge = (props: any) => (
  <VscodeBadge variant="counter" {...props}>
    {props.children}
  </VscodeBadge>
);
