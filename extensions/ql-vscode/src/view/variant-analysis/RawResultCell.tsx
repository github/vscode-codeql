import * as React from "react";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import { CellValue } from "../../common/bqrs-cli-types";
import { sendTelemetry } from "../common/telemetry";
import { convertNonPrintableChars } from "../../common/text-utils";
import { tryGetRemoteLocation } from "../../common/bqrs-utils";

type CellProps = {
  value: CellValue;
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
};

const sendRawResultsLinkTelemetry = () => sendTelemetry("raw-results-link");

export const RawResultCell = ({
  value,
  fileLinkPrefix,
  sourceLocationPrefix,
}: CellProps) => {
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return <span>{convertNonPrintableChars(value.toString())}</span>;
    case "object": {
      const url = tryGetRemoteLocation(
        value.url,
        fileLinkPrefix,
        sourceLocationPrefix,
      );
      const safeLabel = convertNonPrintableChars(value.label);
      if (url) {
        return (
          <VSCodeLink onClick={sendRawResultsLinkTelemetry} href={url}>
            {safeLabel}
          </VSCodeLink>
        );
      } else {
        return <span>{safeLabel}</span>;
      }
    }
  }
};
