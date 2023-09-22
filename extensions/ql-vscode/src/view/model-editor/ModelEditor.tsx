import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ToModelEditorMessage } from "../../common/interface-types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import { styled } from "styled-components";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { assertNever } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";
import { calculateModeledPercentage } from "../../model-editor/shared/modeled-percentage";
import { LinkIconButton } from "../variant-analysis/LinkIconButton";
import { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { ModeledMethodsList } from "./ModeledMethodsList";
import { percentFormatter } from "./formatters";
import { Mode } from "../../model-editor/shared/mode";
import { InProgressMethods } from "../../model-editor/shared/in-progress-methods";
import { getLanguageDisplayName } from "../../common/query-language";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "../../model-editor/shared/hide-modeled-methods";

const LoadingContainer = styled.div`
  text-align: center;
  padding: 1em;
  font-size: x-large;
  font-weight: 600;
`;

const ModelEditorContainer = styled.div`
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
  initialViewState?: ModelEditorViewState;
  initialMethods?: Method[];
  initialModeledMethods?: Record<string, ModeledMethod>;
  initialHideModeledMethods?: boolean;
};

export function ModelEditor({
  initialViewState,
  initialMethods = [],
  initialModeledMethods = {},
  initialHideModeledMethods = INITIAL_HIDE_MODELED_METHODS_VALUE,
}: Props): JSX.Element {
  const [viewState, setViewState] = useState<ModelEditorViewState | undefined>(
    initialViewState,
  );

  const [methods, setMethods] = useState<Method[]>(initialMethods);
  const [modifiedSignatures, setModifiedSignatures] = useState<Set<string>>(
    new Set(),
  );

  const [inProgressMethods, setInProgressMethods] = useState<InProgressMethods>(
    new InProgressMethods(),
  );

  const [hideModeledMethods, setHideModeledMethods] = useState(
    initialHideModeledMethods,
  );

  useEffect(() => {
    vscode.postMessage({
      t: "hideModeledMethods",
      hideModeledMethods,
    });
  }, [hideModeledMethods]);

  const [modeledMethods, setModeledMethods] = useState<
    Record<string, ModeledMethod>
  >(initialModeledMethods);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToModelEditorMessage = evt.data;
        switch (msg.t) {
          case "setModelEditorViewState":
            setViewState(msg.viewState);
            break;
          case "setMethods":
            setMethods(msg.methods);
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
    () => calculateModeledPercentage(methods),
    [methods],
  );

  const onChange = useCallback((model: ModeledMethod) => {
    setModeledMethods((oldModeledMethods) => ({
      ...oldModeledMethods,
      [model.signature]: model,
    }));
    setModifiedSignatures(
      (oldModifiedSignatures) =>
        new Set([...oldModifiedSignatures, model.signature]),
    );
  }, []);

  const onRefreshClick = useCallback(() => {
    vscode.postMessage({
      t: "refreshMethods",
    });
  }, []);

  const onSaveAllClick = useCallback(() => {
    vscode.postMessage({
      t: "saveModeledMethods",
      methods,
      modeledMethods,
    });
    setModifiedSignatures(new Set());
  }, [methods, modeledMethods]);

  const onSaveModelClick = useCallback(
    (methods: Method[], modeledMethods: Record<string, ModeledMethod>) => {
      vscode.postMessage({
        t: "saveModeledMethods",
        methods,
        modeledMethods,
      });
      setModifiedSignatures((oldModifiedSignatures) => {
        const newModifiedSignatures = new Set([...oldModifiedSignatures]);
        for (const method of methods) {
          newModifiedSignatures.delete(method.signature);
        }
        return newModifiedSignatures;
      });
    },
    [],
  );

  const onGenerateFromSourceClick = useCallback(() => {
    vscode.postMessage({
      t: "generateMethod",
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
      methods: Method[],
      modeledMethods: Record<string, ModeledMethod>,
    ) => {
      vscode.postMessage({
        t: "generateMethodsFromLlm",
        packageName,
        methods,
        modeledMethods,
      });
    },
    [],
  );

  const onStopGenerateFromLlmClick = useCallback((packageName: string) => {
    vscode.postMessage({
      t: "stopGeneratingMethodsFromLlm",
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

  const onHideModeledMethods = useCallback(() => {
    setHideModeledMethods((oldHideModeledMethods) => !oldHideModeledMethods);
  }, []);

  if (viewState === undefined || methods.length === 0) {
    return <LoadingContainer>Loading...</LoadingContainer>;
  }

  return (
    <ModelEditorContainer>
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
            <LinkIconButton onClick={onSwitchModeClick}>
              <span slot="start" className="codicon codicon-library"></span>
              {viewState.mode === Mode.Framework
                ? "Model as application"
                : "Model as dependency"}
            </LinkIconButton>
          </HeaderRow>
        </HeaderColumn>
        <HeaderSpacer />
        <HeaderColumn>
          <VSCodeCheckbox
            checked={hideModeledMethods}
            onChange={onHideModeledMethods}
          >
            Hide modeled methods
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
          <VSCodeButton appearance="secondary" onClick={onRefreshClick}>
            Refresh
          </VSCodeButton>
          {viewState.showFlowGeneration &&
            viewState.mode === Mode.Framework && (
              <VSCodeButton onClick={onGenerateFromSourceClick}>
                Generate
              </VSCodeButton>
            )}
        </ButtonsContainer>
        <ModeledMethodsList
          methods={methods}
          modeledMethods={modeledMethods}
          modifiedSignatures={modifiedSignatures}
          inProgressMethods={inProgressMethods}
          viewState={viewState}
          hideModeledMethods={hideModeledMethods}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromLlmClick={onGenerateFromLlmClick}
          onStopGenerateFromLlmClick={onStopGenerateFromLlmClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
          onModelDependencyClick={onModelDependencyClick}
        />
      </EditorContainer>
    </ModelEditorContainer>
  );
}
