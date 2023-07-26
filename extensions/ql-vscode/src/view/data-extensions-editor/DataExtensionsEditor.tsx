import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ToDataExtensionsEditorMessage } from "../../common/interface-types";
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
import { getLanguageDisplayName } from "../../common/query-language";

const LoadingContainer = styled.div`
  text-align: center;
  padding: 1em;
  font-size: x-large;
  font-weight: 600;
`;

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
  const [modifiedSignatures, setModifiedSignatures] = useState<Set<string>>(
    new Set(),
  );

  const [modeledMethods, setModeledMethods] = useState<
    Record<string, ModeledMethod>
  >(initialModeledMethods);

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
          case "loadModeledMethods":
            setModeledMethods((oldModeledMethods) => {
              return {
                ...msg.modeledMethods,
                ...oldModeledMethods,
              };
            });
            break;
          case "addModeledMethods":
            setModeledMethods((oldModeledMethods) => {
              return {
                ...msg.modeledMethods,
                ...Object.fromEntries(
                  Object.entries(oldModeledMethods).filter(
                    ([, value]) => value.type !== "none",
                  ),
                ),
              };
            });
            setModifiedSignatures(
              (oldModifiedSignatures) =>
                new Set([
                  ...oldModifiedSignatures,
                  ...Object.keys(msg.modeledMethods),
                ]),
            );
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
    (modelName: string, method: ExternalApiUsage, model: ModeledMethod) => {
      setModeledMethods((oldModeledMethods) => ({
        ...oldModeledMethods,
        [method.signature]: model,
      }));
      setModifiedSignatures(
        (oldModifiedSignatures) =>
          new Set([...oldModifiedSignatures, method.signature]),
      );
    },
    [],
  );

  const onRefreshClick = useCallback(() => {
    vscode.postMessage({
      t: "refreshExternalApiUsages",
    });
  }, []);

  const onSaveAllClick = useCallback(() => {
    vscode.postMessage({
      t: "saveModeledMethods",
      externalApiUsages,
      modeledMethods,
    });
    setModifiedSignatures(new Set());
  }, [externalApiUsages, modeledMethods]);

  const onSaveModelClick = useCallback(
    (
      externalApiUsages: ExternalApiUsage[],
      modeledMethods: Record<string, ModeledMethod>,
    ) => {
      vscode.postMessage({
        t: "saveModeledMethods",
        externalApiUsages,
        modeledMethods,
      });
      setModifiedSignatures((oldModifiedSignatures) => {
        const newModifiedSignatures = new Set([...oldModifiedSignatures]);
        for (const externalApiUsage of externalApiUsages) {
          newModifiedSignatures.delete(externalApiUsage.signature);
        }
        return newModifiedSignatures;
      });
    },
    [],
  );

  const onGenerateFromSourceClick = useCallback(() => {
    vscode.postMessage({
      t: "generateExternalApi",
    });
  }, []);

  const onModelDependencyClick = useCallback(() => {
    vscode.postMessage({
      t: "modelDependency",
    });
  }, []);

  const onGenerateFromLlmClick = useCallback(
    (
      externalApiUsages: ExternalApiUsage[],
      modeledMethods: Record<string, ModeledMethod>,
    ) => {
      vscode.postMessage({
        t: "generateExternalApiFromLlm",
        externalApiUsages,
        modeledMethods,
      });
    },
    [],
  );

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

  if (viewState === undefined || externalApiUsages.length === 0) {
    return <LoadingContainer>Loading...</LoadingContainer>;
  }

  return (
    <DataExtensionsEditorContainer>
      <ViewTitle>
        {getLanguageDisplayName(viewState.extensionPack.language)}
      </ViewTitle>
      <DetailsContainer>
        <LinkIconButton onClick={onOpenExtensionPackClick}>
          <span slot="start" className="codicon codicon-package"></span>
          {viewState.extensionPack.name}
        </LinkIconButton>
        <div>{percentFormatter.format(modeledPercentage / 100)} modeled</div>
        <div>
          {percentFormatter.format(unModeledPercentage / 100)} unmodeled
        </div>
        {viewState.enableFrameworkMode && (
          <>
            <div>
              Mode:{" "}
              {viewState.mode === Mode.Framework ? "Framework" : "Application"}
            </div>
            <div>
              <LinkIconButton onClick={onSwitchModeClick}>
                <span slot="start" className="codicon codicon-library"></span>
                Switch mode
              </LinkIconButton>
            </div>
          </>
        )}
      </DetailsContainer>

      <EditorContainer>
        <ButtonsContainer>
          <VSCodeButton
            onClick={onSaveAllClick}
            disabled={modifiedSignatures.size === 0}
          >
            Save all
          </VSCodeButton>
          {viewState.enableFrameworkMode && (
            <VSCodeButton appearance="secondary" onClick={onRefreshClick}>
              Refresh
            </VSCodeButton>
          )}
          {viewState.mode === Mode.Framework && (
            <VSCodeButton onClick={onGenerateFromSourceClick}>
              Generate
            </VSCodeButton>
          )}
        </ButtonsContainer>
        <ModeledMethodsList
          externalApiUsages={externalApiUsages}
          modeledMethods={modeledMethods}
          modifiedSignatures={modifiedSignatures}
          viewState={viewState}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromLlmClick={onGenerateFromLlmClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
          onModelDependencyClick={onModelDependencyClick}
        />
      </EditorContainer>
    </DataExtensionsEditorContainer>
  );
}
