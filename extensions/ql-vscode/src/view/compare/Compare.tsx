import * as React from "react";
import { useState, useEffect } from "react";
import { styled } from "styled-components";

import {
  ToCompareViewMessage,
  SetComparisonsMessage,
} from "../../common/interface-types";
import CompareSelector from "./CompareSelector";
import { vscode } from "../vscode-api";
import CompareTable from "./CompareTable";

import "../results/resultsView.css";

const emptyComparison: SetComparisonsMessage = {
  t: "setComparisons",
  stats: {},
  result: undefined,
  commonResultSetNames: [],
  currentResultSetName: "",
  databaseUri: "",
  message: "Empty comparison",
};

const Header = styled.div`
  display: flex;
`;

const HeaderTitle = styled.div`
  margin: 0 1.5rem;
`;

const Message = styled.div`
  padding: 1.5rem;
`;

export function Compare(_: Record<string, never>): JSX.Element {
  const [comparison, setComparison] =
    useState<SetComparisonsMessage>(emptyComparison);

  const message = comparison.message || "Empty comparison";
  const hasRows =
    comparison.result &&
    (comparison.result.to.length || comparison.result.from.length);

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
        <Header>
          <HeaderTitle>Comparing:</HeaderTitle>
          <CompareSelector
            availableResultSets={comparison.commonResultSetNames}
            currentResultSetName={comparison.currentResultSetName}
            updateResultSet={(newResultSetName: string) =>
              vscode.postMessage({ t: "changeCompare", newResultSetName })
            }
          />
        </Header>
        {hasRows ? (
          <CompareTable comparison={comparison}></CompareTable>
        ) : (
          <Message>{message}</Message>
        )}
      </>
    );
  } catch (err) {
    console.error(err);
    return <div>Error!</div>;
  }
}
