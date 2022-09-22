import * as React from 'react';
import styled from 'styled-components';
import classNames from 'classnames';

type Props = {
  name: string;
  label: string;
  className?: string;
};

const CodiconIcon = styled.span`
  vertical-align: text-bottom;
`;

export const Codicon = ({
  name,
  label,
  className
}: Props) => <CodiconIcon role="img" aria-label={label} className={classNames('codicon', `codicon-${name}`, className)} />;
