import { VscodeBadge } from "@vscode-elements/react-elements";

// This applies the counter variant by default so the border-radius attribute is set
export const Badge = (props: React.ComponentProps<typeof VscodeBadge>) => (
  <VscodeBadge variant="counter" {...props}>
    {props.children}
  </VscodeBadge>
);
