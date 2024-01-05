import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import type { CellValue } from "../../common/raw-result-types";
import { sendTelemetry } from "../common/telemetry";
import { convertNonPrintableChars } from "../../common/text-utils";
import { tryGetRemoteLocation } from "../../common/bqrs-utils";
import { RawNumberValue } from "../common/RawNumberValue";

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
  switch (value.type) {
    case "boolean":
      return <span>{value.value.toString()}</span>;
    case "number":
      return <RawNumberValue value={value.value} />;
    case "string":
      return <span>{convertNonPrintableChars(value.value.toString())}</span>;
    case "entity": {
      const url = tryGetRemoteLocation(
        value.value.url,
        fileLinkPrefix,
        sourceLocationPrefix,
      );
      const safeLabel = convertNonPrintableChars(value.value.label);
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
