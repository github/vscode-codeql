import { styled } from "styled-components";

export const HorizontalSpace = styled.div<{ $size: 1 | 2 | 3 }>`
  flex: 0 0 auto;
  display: inline-block;
  width: ${(props) => 0.2 * props.$size}em;
`;
