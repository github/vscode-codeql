import { styled } from "styled-components";
import { Codicon } from "./Codicon";

const Icon = styled(Codicon)`
  color: var(--vscode-problemsErrorIcon-foreground);
`;

type Props = {
  label?: string;
  className?: string;
};

export const ErrorIcon = ({ label = "Error", className }: Props) => (
  <Icon name="error" label={label} className={className} />
);
