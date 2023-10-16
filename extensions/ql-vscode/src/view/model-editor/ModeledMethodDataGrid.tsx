import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { Method, canMethodBeModeled } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { useMemo } from "react";
import { sortMethods } from "../../model-editor/shared/sorting";
import { HiddenMethodsRow } from "./HiddenMethodsRow";
import { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { ScreenReaderOnly } from "../common/ScreenReaderOnly";

export const SINGLE_MODEL_GRID_TEMPLATE_COLUMNS =
  "0.5fr 0.125fr 0.125fr 0.125fr 0.125fr";
export const MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS =
  "0.5fr 0.125fr 0.125fr 0.125fr 0.125fr max-content";

export type ModeledMethodDataGridProps = {
  packageName: string;
  methods: Method[];
  modeledMethodsMap: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  inProgressMethods: Set<string>;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  revealedMethodSignature: string | null;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

export const ModeledMethodDataGrid = ({
  packageName,
  methods,
  modeledMethodsMap,
  modifiedSignatures,
  inProgressMethods,
  viewState,
  hideModeledMethods,
  revealedMethodSignature,
  onChange,
}: ModeledMethodDataGridProps) => {
  const [methodsWithModelability, numHiddenMethods]: [
    Array<{ method: Method; methodCanBeModeled: boolean }>,
    number,
  ] = useMemo(() => {
    const methodsWithModelability = [];
    let numHiddenMethods = 0;
    for (const method of sortMethods(methods)) {
      const modeledMethods = modeledMethodsMap[method.signature] ?? [];
      const methodIsUnsaved = modifiedSignatures.has(method.signature);
      const methodCanBeModeled = canMethodBeModeled(
        method,
        modeledMethods,
        methodIsUnsaved,
      );

      if (methodCanBeModeled || !hideModeledMethods) {
        methodsWithModelability.push({ method, methodCanBeModeled });
      } else {
        numHiddenMethods += 1;
      }
    }
    return [methodsWithModelability, numHiddenMethods];
  }, [hideModeledMethods, methods, modeledMethodsMap, modifiedSignatures]);

  const someMethodsAreVisible = methodsWithModelability.length > 0;

  const gridTemplateColumns = viewState.showMultipleModels
    ? MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS
    : SINGLE_MODEL_GRID_TEMPLATE_COLUMNS;

  return (
    <VSCodeDataGrid gridTemplateColumns={gridTemplateColumns}>
      {someMethodsAreVisible && (
        <>
          <VSCodeDataGridRow rowType="header">
            <VSCodeDataGridCell cellType="columnheader" gridColumn={1}>
              API or method
            </VSCodeDataGridCell>
            <VSCodeDataGridCell cellType="columnheader" gridColumn={2}>
              Model type
            </VSCodeDataGridCell>
            <VSCodeDataGridCell cellType="columnheader" gridColumn={3}>
              Input
            </VSCodeDataGridCell>
            <VSCodeDataGridCell cellType="columnheader" gridColumn={4}>
              Output
            </VSCodeDataGridCell>
            <VSCodeDataGridCell cellType="columnheader" gridColumn={5}>
              Kind
            </VSCodeDataGridCell>
            {viewState.showMultipleModels && (
              <VSCodeDataGridCell cellType="columnheader" gridColumn={6}>
                <ScreenReaderOnly>Add or remove models</ScreenReaderOnly>
              </VSCodeDataGridCell>
            )}
          </VSCodeDataGridRow>
          {methodsWithModelability.map(({ method, methodCanBeModeled }) => {
            const modeledMethods = modeledMethodsMap[method.signature] ?? [];
            return (
              <MethodRow
                key={method.signature}
                method={method}
                methodCanBeModeled={methodCanBeModeled}
                modeledMethods={modeledMethods}
                methodIsUnsaved={modifiedSignatures.has(method.signature)}
                modelingInProgress={inProgressMethods.has(method.signature)}
                viewState={viewState}
                revealedMethodSignature={revealedMethodSignature}
                onChange={onChange}
              />
            );
          })}
        </>
      )}
      <HiddenMethodsRow
        numHiddenMethods={numHiddenMethods}
        someMethodsAreVisible={someMethodsAreVisible}
      />
    </VSCodeDataGrid>
  );
};
