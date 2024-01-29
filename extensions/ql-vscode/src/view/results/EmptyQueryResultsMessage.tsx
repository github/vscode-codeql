import { styled } from "styled-components";
import { sendTelemetry } from "../common/telemetry";

function sendCodeQLLanguageGuidesTelemetry() {
  sendTelemetry("codeql-language-guides-link");
}

const Root = styled.div`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Container = styled.span`
  max-width: 80%;
  font-size: 14px;
  text-align: center;
`;

export function EmptyQueryResultsMessage(): React.JSX.Element {
  return (
    <Root>
      <Container>
        This query returned no results. If this isn&apos;t what you were
        expecting, and for effective query-writing tips, check out the{" "}
        <a
          href="https://codeql.github.com/docs/codeql-language-guides/"
          onClick={sendCodeQLLanguageGuidesTelemetry}
        >
          CodeQL language guides
        </a>
        .
      </Container>
    </Root>
  );
}
