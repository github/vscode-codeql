import { styled } from "styled-components";

export const ResponsiveContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  height: 100vh;
  padding-top: 0.4rem;

  @media (min-height: 300px) {
    align-items: center;
    justify-content: center;
    text-align: center;
  }
`;
