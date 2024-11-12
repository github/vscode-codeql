import { useState, useRef } from "react";
import { styled } from "styled-components";

import type {
  ToCompareViewMessage,
  SetComparisonsMessage,
  SetComparisonQueryInfoMessage,
  UserSettings,
  StreamingComparisonSetupMessage,
  QueryCompareResult,
} from "../../common/interface-types";
import { DEFAULT_USER_SETTINGS } from "../../common/interface-types";
import CompareSelector from "./CompareSelector";
import { vscode } from "../vscode-api";
import CompareTable from "./CompareTable";

import "../results/resultsView.css";
import { assertNever } from "../../common/helpers-pure";
import { useMessageFromExtension } from "../common/useMessageFromExtension";

const Header = styled.div`
  display: flex;
`;

const HeaderTitle = styled.div`
  margin: 0 1.5rem;
`;

const Message = styled.div`
  padding: 1.5rem;
`;

export function Compare(_: Record<string, never>): React.JSX.Element {
  const [queryInfo, setQueryInfo] =
    useState<SetComparisonQueryInfoMessage | null>(null);
  const [comparison, setComparison] = useState<SetComparisonsMessage | null>(
    null,
  );
  const [userSettings, setUserSettings] = useState<UserSettings>(
    DEFAULT_USER_SETTINGS,
  );

  // This is a ref because we don't need to re-render when we get a new streaming comparison message
  // and we don't want to change the listener every time we get a new message
  const streamingComparisonRef = useRef<StreamingComparisonSetupMessage | null>(
    null,
  );

  const message = comparison?.message || "Empty comparison";
  const hasRows =
    comparison?.result &&
    (comparison.result.to.length || comparison.result.from.length);

  useMessageFromExtension<ToCompareViewMessage>((msg) => {
    switch (msg.t) {
      case "setComparisonQueryInfo":
        setQueryInfo(msg);
        break;
      case "setComparisons":
        setComparison(msg);
        break;
      case "streamingComparisonSetup":
        setComparison(null);
        streamingComparisonRef.current = msg;
        break;
      case "streamingComparisonAddResults": {
        const prev = streamingComparisonRef.current;
        if (prev === null) {
          console.warn(
            'Received "streamingComparisonAddResults" before "streamingComparisonSetup"',
          );
          break;
        }

        if (prev.id !== msg.id) {
          console.warn(
            'Received "streamingComparisonAddResults" with different id, ignoring',
          );
          break;
        }

        let result: QueryCompareResult;
        switch (prev.result.kind) {
          case "raw":
            if (msg.result.kind !== "raw") {
              throw new Error(
                "Streaming comparison: expected raw results, got interpreted results",
              );
            }

            result = {
              ...prev.result,
              from: [...prev.result.from, ...msg.result.from],
              to: [...prev.result.to, ...msg.result.to],
            };
            break;
          case "interpreted":
            if (msg.result.kind !== "interpreted") {
              throw new Error(
                "Streaming comparison: expected interpreted results, got raw results",
              );
            }

            result = {
              ...prev.result,
              from: [...prev.result.from, ...msg.result.from],
              to: [...prev.result.to, ...msg.result.to],
            };
            break;
          default:
            throw new Error("Unexpected comparison result kind");
        }

        streamingComparisonRef.current = {
          ...prev,
          result,
        };

        break;
      }
      case "streamingComparisonComplete":
        if (streamingComparisonRef.current === null) {
          console.warn(
            'Received "streamingComparisonComplete" before "streamingComparisonSetup"',
          );
          setComparison(null);
          break;
        }

        if (streamingComparisonRef.current.id !== msg.id) {
          console.warn(
            'Received "streamingComparisonComplete" with different id, ignoring',
          );
          break;
        }

        setComparison({
          ...streamingComparisonRef.current,
          t: "setComparisons",
        });
        streamingComparisonRef.current = null;
        break;
      case "setUserSettings":
        setUserSettings(msg.userSettings);
        break;
      default:
        assertNever(msg);
    }
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
            availableResultSets={queryInfo.commonResultSetNames}
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
            userSettings={userSettings}
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
