import { styled } from "styled-components";
import { Codicon } from "./Codicon";

const Icon = styled(Codicon)`
  color: var(--vscode-testing-iconPassed);
`;

type Props = {
  label?: string;
  className?: string;
};

export const SuccessIcon = ({ label = "Success", className }: Props) => (
  <Icon name="pass" label={label} className={className} />
);
