import { styled } from "styled-components";
import { Codicon } from "./icon";

const Star = styled.span`
  flex-grow: 2;
  text-align: right;
  margin-right: 0;
`;

const Count = styled.span`
  display: inline-block;
  text-align: left;
  width: 2em;
  margin-left: 0.5em;
  margin-right: 1.5em;
`;

type Props = {
  starCount?: number;
};

const StarCount = ({ starCount }: Props) =>
  Number.isFinite(starCount) ? (
    <>
      <Star>
        <Codicon name="star-empty" label="Stars count" />
      </Star>
      <Count>{displayStars(starCount!)}</Count>
    </>
  ) : (
    <></>
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
