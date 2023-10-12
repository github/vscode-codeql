import { styled } from "styled-components";

/**
 * An element that will be hidden from sighted users, but visible to screen readers.
 */
export const ScreenReaderOnly = styled.div`
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;
