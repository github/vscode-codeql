import * as React from "react";
import { styled } from "styled-components";
import * as classNames from "classnames";

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
    className={classNames("codicon", `codicon-${name}`, className)}
    slot={slot}
  />
);
