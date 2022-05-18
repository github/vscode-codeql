import * as React from 'react';
import { StarIcon } from '@primer/octicons-react';

type Props = { starCount?: number };

const StarCount = ({ starCount }: Props) => (
  Number.isFinite(starCount) ? (
    <>
      <span className="vscode-codeql__analysis-star">
        <StarIcon size={16} />
      </span>
      <span className='vscode-codeql__analysis-count'>
        {displayStars(starCount!)}
      </span>
    </>
  ) : (
    <>
      <span className="vscode-codeql__analysis-star">
        {/* empty */}
      </span>
      <span className='vscode-codeql__analysis-count'>
        {/* empty */}
      </span>
    </>
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
