import styled from 'styled-components';

const VerticalSpace = styled.div<{ size: 1 | 2 | 3 }>`
  flex: 0 0 auto;
  height: ${props => 0.5 * props.size}em;
`;

export default VerticalSpace;
