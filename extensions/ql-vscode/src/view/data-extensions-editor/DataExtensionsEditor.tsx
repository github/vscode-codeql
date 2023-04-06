import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShowProgressMessage,
  ToDataExtensionsEditorMessage,
} from "../../pure/interface-types";
import {
  VSCodeButton,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import styled from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { MethodRow } from "./MethodRow";
import { assertNever } from "../../pure/helpers-pure";
import { vscode } from "../vscode-api";
import { calculateSupportedPercentage } from "./supported";

export const DataExtensionsEditorContainer = styled.div`
  margin-top: 1rem;
`;

type ProgressBarProps = {
  completion: number;
};

const ProgressBar = styled.div<ProgressBarProps>`
  height: 10px;
  width: ${(props) => props.completion * 100}%;

  background-color: var(--vscode-progressBar-background);
`;

export function DataExtensionsEditor(): JSX.Element {
  const [externalApiUsages, setExternalApiUsages] = useState<
    ExternalApiUsage[]
  >([]);
  const [modeledMethods, setModeledMethods] = useState<
    Record<string, ModeledMethod>
  >({});
  const [progress, setProgress] = useState<Omit<ShowProgressMessage, "t">>({
    step: 0,
    maxStep: 0,
    message: "",
  });

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToDataExtensionsEditorMessage = evt.data;
        switch (msg.t) {
          case "setExternalApiUsages":
            setExternalApiUsages(msg.externalApiUsages);
            break;
          case "showProgress":
            setProgress(msg);
            break;
          case "setExistingModeledMethods":
            setModeledMethods((oldModeledMethods) => {
              return {
                ...msg.existingModeledMethods,
                ...oldModeledMethods,
              };
            });

            break;
          case "addModeledMethods":
            setModeledMethods((oldModeledMethods) => {
              const filteredOldModeledMethods = Object.fromEntries(
                Object.entries(oldModeledMethods).filter(
                  ([, value]) => value.type !== "none",
                ),
              );

              return {
                ...msg.modeledMethods,
                ...filteredOldModeledMethods,
              };
            });
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

  const supportedPercentage = useMemo(
    () => calculateSupportedPercentage(externalApiUsages),
    [externalApiUsages],
  );

  const unsupportedPercentage = 100 - supportedPercentage;

  const onChange = useCallback(
    (method: ExternalApiUsage, model: ModeledMethod) => {
      setModeledMethods((oldModeledMethods) => ({
        ...oldModeledMethods,
        [method.signature]: model,
      }));
    },
    [],
  );

  const onApplyClick = useCallback(() => {
    vscode.postMessage({
      t: "saveModeledMethods",
      externalApiUsages,
      modeledMethods,
    });
  }, [externalApiUsages, modeledMethods]);

  const onGenerateClick = useCallback(() => {
    vscode.postMessage({
      t: "generateExternalApi",
    });
  }, []);

  return (
    <DataExtensionsEditorContainer>
      {progress.maxStep > 0 && (
        <p>
          <ProgressBar completion={progress.step / progress.maxStep} />{" "}
          {progress.message}
        </p>
      )}

      {externalApiUsages.length > 0 && (
        <>
          <div>
            <h3>External API support stats</h3>
            <ul>
              <li>Supported: {supportedPercentage.toFixed(2)}%</li>
              <li>Unsupported: {unsupportedPercentage.toFixed(2)}%</li>
            </ul>
          </div>
          <div>
            <h3>External API modelling</h3>
            <VSCodeButton onClick={onApplyClick}>Apply</VSCodeButton>
            &nbsp;
            <VSCodeButton onClick={onGenerateClick}>
              Download and generate
            </VSCodeButton>
            <br />
            <br />
            <VSCodeDataGrid>
              <VSCodeDataGridRow rowType="header">
                <VSCodeDataGridCell cellType="columnheader" gridColumn={1}>
                  Type
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={2}>
                  Method
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={3}>
                  Usages
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={4}>
                  Model type
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={5}>
                  Input
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={6}>
                  Output
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn={7}>
                  Kind
                </VSCodeDataGridCell>
              </VSCodeDataGridRow>
              {externalApiUsages.map((externalApiUsage) => (
                <MethodRow
                  key={externalApiUsage.signature}
                  externalApiUsage={externalApiUsage}
                  modeledMethod={modeledMethods[externalApiUsage.signature]}
                  onChange={onChange}
                />
              ))}
            </VSCodeDataGrid>
          </div>
        </>
      )}
    </DataExtensionsEditorContainer>
  );
}
