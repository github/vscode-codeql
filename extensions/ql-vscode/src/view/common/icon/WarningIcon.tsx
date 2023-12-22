import { styled } from "styled-components";
import { Codicon } from "./Codicon";

const Icon = styled(Codicon)`
  color: var(--vscode-problemsWarningIcon-foreground);
`;

type Props = {
  label?: string;
  className?: string;
};

export const WarningIcon = ({ label = "Warning", className }: Props) => (
  <Icon name="warning" label={label} className={className} />
);
