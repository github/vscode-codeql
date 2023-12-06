import * as React from "react";
import { useState, useEffect } from "react";
import { styled } from "styled-components";

import {
  ToCompareViewMessage,
  SetComparisonsMessage,
  SetComparisonQueryInfoMessage,
} from "../../common/interface-types";
import CompareSelector from "./CompareSelector";
import { vscode } from "../vscode-api";
import CompareTable from "./CompareTable";

import "../results/resultsView.css";
import { assertNever } from "../../common/helpers-pure";

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
  const [queryInfo, setQueryInfo] =
    useState<SetComparisonQueryInfoMessage | null>(null);
  const [comparison, setComparison] = useState<SetComparisonsMessage | null>(
    null,
  );

  const message = comparison?.message || "Empty comparison";
  const hasRows =
    comparison?.result &&
    (comparison.result.to.length || comparison.result.from.length);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToCompareViewMessage = evt.data;
        switch (msg.t) {
          case "setComparisonQueryInfo":
            setQueryInfo(msg);
            break;
          case "setComparisons":
            setComparison(msg);
            break;
          default:
            assertNever(msg);
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

  if (!queryInfo || !comparison) {
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
          <CompareTable
            queryInfo={queryInfo}
            comparison={comparison}
          ></CompareTable>
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
