import { styled } from "styled-components";

type Props = {
  name: string;
  label?: string;
  className?: string;
  slot?: string;
};

const CodiconIcon = styled.span`
  vertical-align: text-bottom;
`;

export const Codicon = ({ name, label, className, slot }: Props) => (
  <CodiconIcon
    role="img"
    aria-label={label}
    title={label}
    className={`codicon codicon-${name}${className ? ` ${className}` : ""}`}
    slot={slot}
  />
);
