import * as React from "react";
import { sendTelemetry } from "../common/telemetry";

function sendCodeQLLanguageGuidesTelemetry() {
  sendTelemetry("codeql-language-guides-link");
}

export function EmptyQueryResultsMessage(): JSX.Element {
  return (
    <div className="vscode-codeql__empty-query-message">
      <span>
        This query returned no results. If this isn&apos;t what you were
        expecting, and for effective query-writing tips, check out the{" "}
        <a
          href="https://codeql.github.com/docs/codeql-language-guides/"
          onClick={sendCodeQLLanguageGuidesTelemetry}
        >
          CodeQL language guides
        </a>
        .
      </span>
    </div>
  );
}
