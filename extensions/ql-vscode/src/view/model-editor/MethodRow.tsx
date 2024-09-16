import {
  VSCodeBadge,
  VSCodeButton,
  VSCodeLink,
} from "@vscode/webview-ui-toolkit/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { styled } from "styled-components";
import { vscode } from "../vscode-api";

import type { Method } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelKindDropdown } from "./ModelKindDropdown";
import { Mode } from "../../model-editor/shared/mode";
import { MethodClassifications } from "./MethodClassifications";
import { getModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "./ModelingStatusIndicator";
import { MethodName } from "./MethodName";
import { ModelTypeDropdown } from "./ModelTypeDropdown";
import { ModelInputDropdown } from "./ModelInputDropdown";
import { ModelOutputDropdown } from "./ModelOutputDropdown";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { Codicon } from "../common";
import { canAddNewModeledMethod } from "../../model-editor/shared/multiple-modeled-methods";
import { DataGridCell, DataGridRow } from "../common/DataGrid";
import { validateModeledMethods } from "../../model-editor/shared/validation";
import { ModeledMethodAlert } from "../method-modeling/ModeledMethodAlert";
import { createEmptyModeledMethod } from "../../model-editor/modeled-method-empty";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { ModelInputSuggestBox } from "./ModelInputSuggestBox";
import { ModelOutputSuggestBox } from "./ModelOutputSuggestBox";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { ModelAlertsIndicator } from "./ModelAlertsIndicator";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";

const ApiOrMethodRow = styled.div`
  min-height: calc(var(--input-height) * 1px);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
`;

const ModelButtonsContainer = styled.div`
  min-height: calc(var(--input-height) * 1px);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1em;
`;

const UsagesButton = styled(VSCodeBadge)`
  cursor: pointer;
`;

const ViewLink = styled(VSCodeLink)`
  white-space: nowrap;
`;

const CodiconRow = styled(VSCodeButton)`
  min-height: calc(var(--input-height) * 1px);
  align-items: center;
`;

export type MethodRowProps = {
  method: Method;
  methodCanBeModeled: boolean;
  modeledMethods: ModeledMethod[];
  methodIsUnsaved: boolean;
  methodIsSelected: boolean;
  viewState: ModelEditorViewState;
  revealedMethodSignature: string | null;
  inputAccessPathSuggestions?: AccessPathOption[];
  outputAccessPathSuggestions?: AccessPathOption[];
  evaluationRun: ModelEvaluationRunState | undefined;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
  onMethodClick: (methodSignature: string) => void;
};

export const MethodRow = (props: MethodRowProps) => {
  const { method, methodCanBeModeled, revealedMethodSignature } = props;

  const ref = useRef<HTMLElement>();

  useEffect(() => {
    if (method.signature === revealedMethodSignature) {
      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [method, revealedMethodSignature]);

  if (methodCanBeModeled) {
    return <ModelableMethodRow {...props} ref={ref} />;
  } else {
    return <UnmodelableMethodRow {...props} ref={ref} />;
  }
};

const ModelableMethodRow = forwardRef<HTMLElement | undefined, MethodRowProps>(
  (props: MethodRowProps, ref) => {
    const {
      method,
      modeledMethods: modeledMethodsProp,
      methodIsUnsaved,
      methodIsSelected,
      viewState,
      revealedMethodSignature,
      inputAccessPathSuggestions,
      outputAccessPathSuggestions,
      evaluationRun,
      onChange,
      onMethodClick,
    } = props;

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    useEffect(() => {
      if (focusedIndex === null) {
        return;
      }

      // If a row is focused, hide it when the user clicks anywhere. In this case, we do need to
      // show the user where the method is anymore and they should have seen it.
      const listener = () => {
        setFocusedIndex(null);
      };

      // Use a timeout to ensure the click event is not triggered by the click that focused the row.
      const timeoutId = setTimeout(
        () => window.addEventListener("click", listener),
        200,
      );

      return () => {
        clearTimeout(timeoutId);

        window.removeEventListener("click", listener);
      };
    }, [focusedIndex]);

    const modeledMethods = useMemo(
      () => modeledMethodsToDisplay(modeledMethodsProp, method),
      [modeledMethodsProp, method],
    );

    const validationErrors = useMemo(
      () => validateModeledMethods(modeledMethods),
      [modeledMethods],
    );

    const modeledMethodChangedHandlers = useMemo(
      () =>
        modeledMethods.map((_, index) => (modeledMethod: ModeledMethod) => {
          const newModeledMethods = [...modeledMethods];
          newModeledMethods[index] = modeledMethod;
          onChange(method.signature, newModeledMethods);
        }),
      [method, modeledMethods, onChange],
    );

    const removeModelClickedHandlers = useMemo(
      () =>
        modeledMethods.map((_, index) => () => {
          const newModeledMethods = [...modeledMethods];
          newModeledMethods.splice(index, 1);
          onChange(method.signature, newModeledMethods);
        }),
      [method, modeledMethods, onChange],
    );

    const handleAddModelClick = useCallback(() => {
      const newModeledMethod: ModeledMethod = createEmptyModeledMethod(
        "none",
        method,
      );
      const newModeledMethods = [...modeledMethods, newModeledMethod];
      onChange(method.signature, newModeledMethods);
    }, [method, modeledMethods, onChange]);

    const jumpToMethod = useCallback(
      () => sendJumpToMethodMessage(method),
      [method],
    );

    // Only show modeled methods that are non-hidden. These are also the ones that are
    // used for determining the modeling status.
    const shownModeledMethods = useMemo(() => {
      const modelsAsDataLanguage = getModelsAsDataLanguage(viewState.language);

      return modeledMethodsToDisplay(
        modeledMethods.filter((modeledMethod) => {
          if (modeledMethod.type === "none") {
            return true;
          }

          const predicate = modelsAsDataLanguage.predicates[modeledMethod.type];
          if (!predicate) {
            return true;
          }

          return !predicate.isHidden?.({
            method,
            config: viewState.modelConfig,
          });
        }),
        method,
      );
    }, [method, modeledMethods, viewState]);

    const modelingStatus = getModelingStatus(
      shownModeledMethods,
      methodIsUnsaved,
    );

    const addModelButtonDisabled = !canAddNewModeledMethod(shownModeledMethods);

    return (
      <DataGridRow
        data-testid="modelable-method-row"
        focused={revealedMethodSignature === method.signature}
        selected={methodIsSelected}
        onClick={() => {
          onMethodClick(method.signature);
        }}
      >
        <DataGridCell
          gridRow={`span ${shownModeledMethods.length + validationErrors.length}`}
          ref={ref}
        >
          <ApiOrMethodRow>
            <ModelingStatusIndicator status={modelingStatus} />
            <MethodClassifications method={method} />
            <MethodName {...props.method} />
            {viewState.mode === Mode.Application && (
              <UsagesButton
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  jumpToMethod();
                }}
              >
                {method.usages.length}
              </UsagesButton>
            )}
            <ViewLink
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                jumpToMethod();
              }}
            >
              View
            </ViewLink>
          </ApiOrMethodRow>
        </DataGridCell>

        {shownModeledMethods.map((modeledMethod, index) => {
          return (
            <DataGridRow key={index} focused={focusedIndex === index}>
              <DataGridCell>
                <ModelTypeDropdown
                  language={viewState.language}
                  modelConfig={viewState.modelConfig}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
                />
              </DataGridCell>
              <DataGridCell>
                {inputAccessPathSuggestions === undefined ? (
                  <ModelInputDropdown
                    language={viewState.language}
                    method={method}
                    modeledMethod={modeledMethod}
                    onChange={modeledMethodChangedHandlers[index]}
                  />
                ) : (
                  <ModelInputSuggestBox
                    modeledMethod={modeledMethod}
                    suggestions={inputAccessPathSuggestions}
                    typePathSuggestions={outputAccessPathSuggestions ?? []}
                    onChange={modeledMethodChangedHandlers[index]}
                  />
                )}
              </DataGridCell>
              <DataGridCell>
                {outputAccessPathSuggestions === undefined ? (
                  <ModelOutputDropdown
                    language={viewState.language}
                    method={method}
                    modeledMethod={modeledMethod}
                    onChange={modeledMethodChangedHandlers[index]}
                  />
                ) : (
                  <ModelOutputSuggestBox
                    modeledMethod={modeledMethod}
                    suggestions={outputAccessPathSuggestions}
                    onChange={modeledMethodChangedHandlers[index]}
                  />
                )}
              </DataGridCell>
              <DataGridCell>
                <ModelKindDropdown
                  language={viewState.language}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
                />
              </DataGridCell>
              <DataGridCell>
                <ModelButtonsContainer>
                  <ModelAlertsIndicator
                    viewState={viewState}
                    modeledMethod={modeledMethod}
                    evaluationRun={evaluationRun}
                  ></ModelAlertsIndicator>
                  {index === 0 ? (
                    <CodiconRow
                      appearance="icon"
                      aria-label="Add new model"
                      onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        handleAddModelClick();
                      }}
                      disabled={addModelButtonDisabled}
                    >
                      <Codicon name="add" />
                    </CodiconRow>
                  ) : (
                    <CodiconRow
                      appearance="icon"
                      aria-label="Remove model"
                      onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        removeModelClickedHandlers[index]();
                      }}
                    >
                      <Codicon name="trash" />
                    </CodiconRow>
                  )}
                </ModelButtonsContainer>
              </DataGridCell>
            </DataGridRow>
          );
        })}
        {validationErrors.map((error, index) => (
          <DataGridCell gridColumn="span 5" key={index}>
            <ModeledMethodAlert
              error={error}
              setSelectedIndex={setFocusedIndex}
            />
          </DataGridCell>
        ))}
      </DataGridRow>
    );
  },
);
ModelableMethodRow.displayName = "ModelableMethodRow";

const UnmodelableMethodRow = forwardRef<
  HTMLElement | undefined,
  MethodRowProps
>((props: MethodRowProps, ref) => {
  const { method, viewState, revealedMethodSignature } = props;

  const jumpToMethod = useCallback(
    () => sendJumpToMethodMessage(method),
    [method],
  );

  return (
    <DataGridRow
      data-testid="unmodelable-method-row"
      focused={revealedMethodSignature === method.signature}
    >
      <DataGridCell ref={ref}>
        <ApiOrMethodRow>
          <ModelingStatusIndicator status="saved" />
          <MethodClassifications method={method} />
          <MethodName {...props.method} />
          {viewState.mode === Mode.Application && (
            <UsagesButton onClick={jumpToMethod}>
              {method.usages.length}
            </UsagesButton>
          )}
          <ViewLink onClick={jumpToMethod}>View</ViewLink>
        </ApiOrMethodRow>
      </DataGridCell>
      <DataGridCell gridColumn="span 5">Method already modeled</DataGridCell>
    </DataGridRow>
  );
});
UnmodelableMethodRow.displayName = "UnmodelableMethodRow";

function sendJumpToMethodMessage(method: Method) {
  vscode.postMessage({
    t: "jumpToMethod",
    methodSignature: method.signature,
  });
}

function modeledMethodsToDisplay(
  modeledMethods: ModeledMethod[],
  method: Method,
): ModeledMethod[] {
  if (modeledMethods.length === 0) {
    return [createEmptyModeledMethod("none", method)];
  }

  return modeledMethods;
}
