import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ToDataExtensionsEditorMessage } from "../../common/interface-types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import { styled } from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { assertNever } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";
import { calculateModeledPercentage } from "../../data-extensions-editor/shared/modeled-percentage";
import { LinkIconButton } from "../variant-analysis/LinkIconButton";
import { DataExtensionEditorViewState } from "../../data-extensions-editor/shared/view-state";
import { ModeledMethodsList } from "./ModeledMethodsList";
import { percentFormatter } from "./formatters";
import { Mode } from "../../data-extensions-editor/shared/mode";
import { InProgressMethods } from "../../data-extensions-editor/shared/in-progress-methods";
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

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: end;
`;

const HeaderColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
`;

const HeaderSpacer = styled.div`
  flex-grow: 1;
`;

const HeaderRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 1em;
  align-items: center;
`;

const ViewTitle = styled.h1`
  font-size: 2em;
  font-weight: 500;
  margin: 0;
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

  const [inProgressMethods, setInProgressMethods] = useState<InProgressMethods>(
    new InProgressMethods(),
  );

  const [hideModeledApis, setHideModeledApis] = useState(true);

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
          case "setInProgressMethods":
            setInProgressMethods((oldInProgressMethods) =>
              oldInProgressMethods.setPackageMethods(
                msg.packageName,
                new Set(msg.inProgressMethods),
              ),
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
      packageName: string,
      externalApiUsages: ExternalApiUsage[],
      modeledMethods: Record<string, ModeledMethod>,
    ) => {
      vscode.postMessage({
        t: "generateExternalApiFromLlm",
        packageName,
        externalApiUsages,
        modeledMethods,
      });
    },
    [],
  );

  const onStopGenerateFromLlmClick = useCallback((packageName: string) => {
    vscode.postMessage({
      t: "stopGeneratingExternalApiFromLlm",
      packageName,
    });
  }, []);

  const onOpenDatabaseClick = useCallback(() => {
    vscode.postMessage({
      t: "openDatabase",
    });
  }, []);

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

  const onHideModeledApis = useCallback(() => {
    setHideModeledApis((oldHideModeledApis) => !oldHideModeledApis);

    vscode.postMessage({
      t: "hideModeledApis",
      hideModeledApis: !hideModeledApis,
    });
  }, [hideModeledApis]);

  if (viewState === undefined || externalApiUsages.length === 0) {
    return <LoadingContainer>Loading...</LoadingContainer>;
  }

  return (
    <DataExtensionsEditorContainer>
      <HeaderContainer>
        <HeaderColumn>
          <HeaderRow>
            <ViewTitle>
              {getLanguageDisplayName(viewState.extensionPack.language)}
            </ViewTitle>
            <VSCodeTag>
              {percentFormatter.format(modeledPercentage / 100)} modeled
            </VSCodeTag>
          </HeaderRow>
          <HeaderRow>
            <>{viewState.extensionPack.name}</>
          </HeaderRow>
          <HeaderRow>
            <LinkIconButton onClick={onOpenDatabaseClick}>
              <span slot="start" className="codicon codicon-package"></span>
              Open database
            </LinkIconButton>
            <LinkIconButton onClick={onOpenExtensionPackClick}>
              <span slot="start" className="codicon codicon-package"></span>
              Open extension pack
            </LinkIconButton>
            {viewState.enableFrameworkMode && (
              <LinkIconButton onClick={onSwitchModeClick}>
                <span slot="start" className="codicon codicon-library"></span>
                {viewState.mode === Mode.Framework
                  ? "Model as application"
                  : "Model as dependency"}
              </LinkIconButton>
            )}
          </HeaderRow>
        </HeaderColumn>
        <HeaderSpacer />
        <HeaderColumn>
          <VSCodeCheckbox
            checked={hideModeledApis}
            onChange={onHideModeledApis}
          >
            Hide modeled APIs
          </VSCodeCheckbox>
        </HeaderColumn>
      </HeaderContainer>

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
          inProgressMethods={inProgressMethods}
          viewState={viewState}
          hideModeledApis={hideModeledApis}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromLlmClick={onGenerateFromLlmClick}
          onStopGenerateFromLlmClick={onStopGenerateFromLlmClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
          onModelDependencyClick={onModelDependencyClick}
        />
      </EditorContainer>
    </DataExtensionsEditorContainer>
  );
}
