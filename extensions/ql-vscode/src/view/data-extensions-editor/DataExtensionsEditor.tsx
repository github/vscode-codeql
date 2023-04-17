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
import { calculateModeledPercentage } from "./modeled";
import { LinkIconButton } from "../variant-analysis/LinkIconButton";
import { basename } from "../common/path";
import { ViewTitle } from "../common";

const DataExtensionsEditorContainer = styled.div`
  margin-top: 1rem;
`;

const DetailsContainer = styled.div`
  display: flex;
  gap: 1em;
  align-items: center;
`;

const EditorContainer = styled.div`
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

type Props = {
  initialModelFilename?: string;
  initialExternalApiUsages?: ExternalApiUsage[];
  initialModeledMethods?: Record<string, ModeledMethod>;
};

export function DataExtensionsEditor({
  initialModelFilename,
  initialExternalApiUsages = [],
  initialModeledMethods = {},
}: Props): JSX.Element {
  const [modelFilename, setModelFilename] = useState<string | undefined>(
    initialModelFilename,
  );

  const [externalApiUsages, setExternalApiUsages] = useState<
    ExternalApiUsage[]
  >(initialExternalApiUsages);
  const [modeledMethods, setModeledMethods] = useState<
    Record<string, ModeledMethod>
  >(initialModeledMethods);
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
          case "setDataExtensionEditorInitialData":
            setModelFilename(msg.modelFilename);
            break;
          case "setExternalApiUsages":
            setExternalApiUsages(msg.externalApiUsages);
            break;
          case "showProgress":
            setProgress(msg);
            break;
          case "addModeledMethods":
            setModeledMethods((oldModeledMethods) => {
              const filteredOldModeledMethods = msg.overrideNone
                ? Object.fromEntries(
                    Object.entries(oldModeledMethods).filter(
                      ([, value]) => value.type !== "none",
                    ),
                  )
                : oldModeledMethods;

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

  const modeledPercentage = useMemo(
    () => calculateModeledPercentage(externalApiUsages),
    [externalApiUsages],
  );

  const unModeledPercentage = 100 - modeledPercentage;

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

  const onOpenModelFileClick = useCallback(() => {
    vscode.postMessage({
      t: "openModelFile",
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
          <ViewTitle>Data extensions editor</ViewTitle>
          <DetailsContainer>
            {modelFilename && (
              <LinkIconButton onClick={onOpenModelFileClick}>
                <span slot="start" className="codicon codicon-file-code"></span>
                {basename(modelFilename)}
              </LinkIconButton>
            )}
            <div>{modeledPercentage.toFixed(2)}% modeled</div>
            <div>{unModeledPercentage.toFixed(2)}% unmodeled</div>
          </DetailsContainer>

          <EditorContainer>
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
          </EditorContainer>
        </>
      )}
    </DataExtensionsEditorContainer>
  );
}
