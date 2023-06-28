import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShowProgressMessage,
  ToDataExtensionsEditorMessage,
} from "../../common/interface-types";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import styled from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { assertNever } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";
import { calculateModeledPercentage } from "../../data-extensions-editor/shared/modeled-percentage";
import { LinkIconButton } from "../variant-analysis/LinkIconButton";
import { ViewTitle } from "../common";
import { DataExtensionEditorViewState } from "../../data-extensions-editor/shared/view-state";
import { ModeledMethodsList } from "./ModeledMethodsList";
import { percentFormatter } from "./formatters";
import { Mode } from "../../data-extensions-editor/shared/mode";

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

const ButtonsContainer = styled.div`
  display: flex;
  gap: 0.4em;
  margin-bottom: 1rem;
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
  initialViewState?: DataExtensionEditorViewState;
  initialExternalApiUsages?: ExternalApiUsage[];
  initialModeledMethods?: Record<string, ModeledMethod>;
};

export function DataExtensionsEditor({
  initialViewState,
  initialExternalApiUsages = [],
  initialModeledMethods = {},
}: Props): JSX.Element {
  const [viewState, setViewState] = useState<
    DataExtensionEditorViewState | undefined
  >(initialViewState);

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
          case "setDataExtensionEditorViewState":
            setViewState(msg.viewState);
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

  const onRefreshClick = useCallback(() => {
    vscode.postMessage({
      t: "refreshExternalApiUsages",
    });
  }, []);

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

  const onGenerateFromLlmClick = useCallback(() => {
    vscode.postMessage({
      t: "generateExternalApiFromLlm",
      externalApiUsages,
      modeledMethods,
    });
  }, [externalApiUsages, modeledMethods]);

  const onOpenExtensionPackClick = useCallback(() => {
    vscode.postMessage({
      t: "openExtensionPack",
    });
  }, []);

  const onSwitchModeClick = useCallback(() => {
    const newMode =
      viewState?.mode === Mode.Framework ? Mode.Application : Mode.Framework;

    vscode.postMessage({
      t: "switchMode",
      mode: newMode,
    });
  }, [viewState?.mode]);

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
            {viewState?.extensionPack && (
              <>
                <LinkIconButton onClick={onOpenExtensionPackClick}>
                  <span slot="start" className="codicon codicon-package"></span>
                  {viewState.extensionPack.name}
                </LinkIconButton>
              </>
            )}
            <div>
              {percentFormatter.format(modeledPercentage / 100)} modeled
            </div>
            <div>
              {percentFormatter.format(unModeledPercentage / 100)} unmodeled
            </div>
            {viewState?.enableFrameworkMode && (
              <>
                <div>
                  Mode:{" "}
                  {viewState?.mode === Mode.Framework
                    ? "Framework"
                    : "Application"}
                </div>
                <div>
                  <LinkIconButton onClick={onSwitchModeClick}>
                    <span
                      slot="start"
                      className="codicon codicon-library"
                    ></span>
                    Switch mode
                  </LinkIconButton>
                </div>
              </>
            )}
          </DetailsContainer>

          <EditorContainer>
            <ButtonsContainer>
              <VSCodeButton onClick={onApplyClick}>Apply</VSCodeButton>
              {viewState?.enableFrameworkMode && (
                <VSCodeButton appearance="secondary" onClick={onRefreshClick}>
                  Refresh
                </VSCodeButton>
              )}
              <VSCodeButton onClick={onGenerateClick}>
                {viewState?.mode === Mode.Framework
                  ? "Generate"
                  : "Download and generate"}
              </VSCodeButton>
              {viewState?.showLlmButton && (
                <>
                  <VSCodeButton onClick={onGenerateFromLlmClick}>
                    Generate using LLM
                  </VSCodeButton>
                </>
              )}
            </ButtonsContainer>
            <ModeledMethodsList
              externalApiUsages={externalApiUsages}
              modeledMethods={modeledMethods}
              mode={viewState?.mode ?? Mode.Application}
              onChange={onChange}
            />
          </EditorContainer>
        </>
      )}
    </DataExtensionsEditorContainer>
  );
}
