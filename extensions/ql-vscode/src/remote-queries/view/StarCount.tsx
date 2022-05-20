import * as React from 'react';
import { StarIcon } from '@primer/octicons-react';
import styled from 'styled-components';

const Star = styled.span`
  flex-grow: 2;
  text-align: right;
  margin-right: 0;
`;

const Count = styled.span`
  text-align: left;
  width: 2em;
  margin-left: 0.5em;
`;

type Props = { starCount?: number };

const StarCount = ({ starCount }: Props) => (
  Number.isFinite(starCount) ? (
    <>
      <Star>
        <StarIcon size={16} />
      </Star>
      <Count>
        {displayStars(starCount!)}
      </Count>
    </>
  ) : (
    <></>
  )
);

function displayStars(starCount: number) {
  if (starCount > 10000) {
    return `${(starCount / 1000).toFixed(0)}k`;
  }
  if (starCount > 1000) {
    return `${(starCount / 1000).toFixed(1)}k`;
  }
  return starCount.toFixed(0);
}

export default StarCount;
