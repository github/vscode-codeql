import { useCallback, useEffect, useMemo, useState } from "react";
import type { ToModelEditorMessage } from "../../common/interface-types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import { styled } from "styled-components";
import type { Method } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { assertNever } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";
import { calculateModeledPercentage } from "../../model-editor/shared/modeled-percentage";
import { LinkIconButton } from "../variant-analysis/LinkIconButton";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { ModeledMethodsList } from "./ModeledMethodsList";
import { percentFormatter } from "./formatters";
import { Mode } from "../../model-editor/shared/mode";
import { getLanguageDisplayName } from "../../common/query-language";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "../../model-editor/shared/hide-modeled-methods";
import type { AccessPathSuggestionOptions } from "../../model-editor/suggestions";

const LoadingContainer = styled.div`
  text-align: center;
  padding: 1em;
  font-size: x-large;
  font-weight: 600;
`;

const ModelEditorContainer = styled.div``;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: end;
  background-color: var(--vscode-editor-background);
  position: sticky;
  z-index: 1;
  top: 0;
  padding-top: 1rem;
  padding-bottom: 1rem;
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
  margin-top: 1rem;
`;

type Props = {
  initialViewState?: ModelEditorViewState;
  initialMethods?: Method[];
  initialModeledMethods?: Record<string, ModeledMethod[]>;
  initialHideModeledMethods?: boolean;
};

export function ModelEditor({
  initialViewState,
  initialMethods = [],
  initialModeledMethods = {},
  initialHideModeledMethods = INITIAL_HIDE_MODELED_METHODS_VALUE,
}: Props): React.JSX.Element {
  const [viewState, setViewState] = useState<ModelEditorViewState | undefined>(
    initialViewState,
  );

  const [methods, setMethods] = useState<Method[]>(initialMethods);
  const [modifiedSignatures, setModifiedSignatures] = useState<Set<string>>(
    new Set(),
  );

  const [selectedSignatures, setSelectedSignatures] = useState<Set<string>>(
    new Set(),
  );

  const [inProgressMethods, setInProgressMethods] = useState<Set<string>>(
    new Set(),
  );

  const [hideModeledMethods, setHideModeledMethods] = useState(
    initialHideModeledMethods,
  );

  const [revealedMethodSignature, setRevealedMethodSignature] = useState<
    string | null
  >(null);

  useEffect(() => {
    vscode.postMessage({
      t: "hideModeledMethods",
      hideModeledMethods,
    });
  }, [hideModeledMethods]);

  const [modeledMethods, setModeledMethods] = useState<
    Record<string, ModeledMethod[]>
  >(initialModeledMethods);

  const [accessPathSuggestions, setAccessPathSuggestions] = useState<
    AccessPathSuggestionOptions | undefined
  >(undefined);

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
          case "setModeledMethods":
            setModeledMethods(msg.methods);
            break;
          case "setModifiedMethods":
            setModifiedSignatures(new Set(msg.methodSignatures));
            break;
          case "setInProgressMethods": {
            setInProgressMethods(new Set(msg.methods));
            break;
          }
          case "revealMethod":
            setRevealedMethodSignature(msg.methodSignature);
            break;
          case "setAccessPathSuggestions":
            setAccessPathSuggestions(msg.accessPathSuggestions);
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

  useEffect(() => {
    // If there is a revealed method signature, hide it when the user clicks anywhere. In this case, we do need to
    // show the user where the method is anymore and they should have seen it.
    const listener = () => {
      setRevealedMethodSignature(null);
    };

    window.addEventListener("click", listener);

    return () => {
      window.removeEventListener("click", listener);
    };
  }, []);

  const modeledPercentage = useMemo(
    () => calculateModeledPercentage(methods),
    [methods],
  );

  const onChange = useCallback(
    (methodSignature: string, modeledMethods: ModeledMethod[]) => {
      vscode.postMessage({
        t: "setMultipleModeledMethods",
        methodSignature,
        modeledMethods,
      });
    },
    [],
  );

  const onMethodClick = useCallback(
    (methodSignature: string) => {
      const newSelectedSignatures = new Set(selectedSignatures);
      if (selectedSignatures.has(methodSignature)) {
        newSelectedSignatures.delete(methodSignature);
      } else {
        newSelectedSignatures.add(methodSignature);
      }
      setSelectedSignatures(newSelectedSignatures);
    },
    [selectedSignatures],
  );

  const onRefreshClick = useCallback(() => {
    vscode.postMessage({
      t: "refreshMethods",
    });
  }, []);

  const onSaveAllClick = useCallback(() => {
    vscode.postMessage({
      t: "saveModeledMethods",
      methodSignatures:
        selectedSignatures.size === 0
          ? undefined
          : Array.from(selectedSignatures),
    });
  }, [selectedSignatures]);

  const onDeselectAllClick = useCallback(() => {
    setSelectedSignatures(new Set());
  }, []);

  const onSaveModelClick = useCallback(
    (methodSignatures: string[]) => {
      vscode.postMessage({
        t: "saveModeledMethods",
        methodSignatures:
          selectedSignatures.size === 0
            ? methodSignatures
            : methodSignatures.filter((signature) =>
                selectedSignatures.has(signature),
              ),
      });
    },
    [selectedSignatures],
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
    (packageName: string, methodSignatures: string[]) => {
      vscode.postMessage({
        t: "generateMethodsFromLlm",
        packageName,
        methodSignatures,
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
            {viewState.sourceArchiveAvailable && (
              <LinkIconButton onClick={onOpenDatabaseClick}>
                <span slot="start" className="codicon codicon-package"></span>
                Open source
              </LinkIconButton>
            )}
            <LinkIconButton onClick={onOpenExtensionPackClick}>
              <span slot="start" className="codicon codicon-package"></span>
              Open extension pack
            </LinkIconButton>
            {viewState.showModeSwitchButton && (
              <LinkIconButton onClick={onSwitchModeClick}>
                <span slot="start" className="codicon codicon-library"></span>
                {viewState.mode === Mode.Framework
                  ? "Model as application"
                  : "Model as dependency"}
              </LinkIconButton>
            )}
          </HeaderRow>
          <HeaderRow>
            <ButtonsContainer>
              <VSCodeButton
                onClick={onSaveAllClick}
                disabled={modifiedSignatures.size === 0}
              >
                {selectedSignatures.size === 0 ? "Save all" : "Save selected"}
              </VSCodeButton>
              <VSCodeButton
                appearance="secondary"
                onClick={onDeselectAllClick}
                disabled={selectedSignatures.size === 0}
              >
                Deselect all
              </VSCodeButton>
              <VSCodeButton appearance="secondary" onClick={onRefreshClick}>
                Refresh
              </VSCodeButton>
              {viewState.showGenerateButton &&
                viewState.mode === Mode.Framework && (
                  <VSCodeButton onClick={onGenerateFromSourceClick}>
                    Generate
                  </VSCodeButton>
                )}
            </ButtonsContainer>
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
        <ModeledMethodsList
          methods={methods}
          modeledMethodsMap={modeledMethods}
          modifiedSignatures={modifiedSignatures}
          selectedSignatures={selectedSignatures}
          inProgressMethods={inProgressMethods}
          viewState={viewState}
          hideModeledMethods={hideModeledMethods}
          revealedMethodSignature={revealedMethodSignature}
          accessPathSuggestions={accessPathSuggestions}
          onChange={onChange}
          onMethodClick={onMethodClick}
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
