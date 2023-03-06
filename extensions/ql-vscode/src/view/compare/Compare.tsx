import * as React from "react";
import { useState, useEffect } from "react";

import {
  ToCompareViewMessage,
  SetComparisonsMessage,
} from "../../pure/interface-types";
import CompareSelector from "./CompareSelector";
import { vscode } from "../vscode-api";
import CompareTable from "./CompareTable";

import "../results/resultsView.css";
import { useUnhandledErrorListener } from "../common/errors";

const emptyComparison: SetComparisonsMessage = {
  t: "setComparisons",
  stats: {},
  rows: undefined,
  columns: [],
  commonResultSetNames: [],
  currentResultSetName: "",
  databaseUri: "",
  message: "Empty comparison",
};

export function Compare(_: Record<string, never>): JSX.Element {
  useUnhandledErrorListener();

  const [comparison, setComparison] =
    useState<SetComparisonsMessage>(emptyComparison);

  const message = comparison.message || "Empty comparison";
  const hasRows =
    comparison.rows &&
    (comparison.rows.to.length || comparison.rows.from.length);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToCompareViewMessage = evt.data;
        switch (msg.t) {
          case "setComparisons":
            setComparison(msg);
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);
  if (!comparison) {
    return <div>Waiting for results to load.</div>;
  }

  try {
    return (
      <>
        <div className="vscode-codeql__compare-header">
          <div className="vscode-codeql__compare-header-item">
            Table to compare:
          </div>
          <CompareSelector
            availableResultSets={comparison.commonResultSetNames}
            currentResultSetName={comparison.currentResultSetName}
            updateResultSet={(newResultSetName: string) =>
              vscode.postMessage({ t: "changeCompare", newResultSetName })
            }
          />
        </div>
        {hasRows ? (
          <CompareTable comparison={comparison}></CompareTable>
        ) : (
          <div className="vscode-codeql__compare-message">{message}</div>
        )}
      </>
    );
  } catch (err) {
    console.error(err);
    return <div>Error!</div>;
  }
}
