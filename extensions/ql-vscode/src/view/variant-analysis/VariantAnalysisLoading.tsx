import { styled } from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  padding: 1em;
`;

const FirstRow = styled.div`
  font-size: x-large;
  font-weight: 600;
`;

const SecondRow = styled.div`
  color: var(--vscode-descriptionForeground);
`;

export const VariantAnalysisLoading = () => {
  return (
    <Container>
      <FirstRow>We are getting everything ready</FirstRow>
      <SecondRow>Results will appear here shortly</SecondRow>
    </Container>
  );
};
