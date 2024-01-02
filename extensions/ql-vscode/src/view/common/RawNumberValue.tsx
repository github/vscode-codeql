import { styled } from "styled-components";
import { formatDecimal } from "../../common/number";

const RightAlignedSpan = styled.span`
  display: inline-block;
  text-align: right;
  width: 100%;
`;

type Props = {
  value: number;
};

export const RawNumberValue = ({ value }: Props) => {
  return <RightAlignedSpan>{formatDecimal(value)}</RightAlignedSpan>;
};
