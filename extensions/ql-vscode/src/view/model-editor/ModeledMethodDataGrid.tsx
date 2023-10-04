import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { useMemo } from "react";
import { sortMethods } from "../../model-editor/shared/sorting";
import { InProgressMethods } from "../../model-editor/shared/in-progress-methods";
import { HiddenMethodsRow } from "./HiddenMethodsRow";
import { ModelEditorViewState } from "../../model-editor/shared/view-state";

export const GRID_TEMPLATE_COLUMNS = "0.5fr 0.125fr 0.125fr 0.125fr 0.125fr";

export type ModeledMethodDataGridProps = {
  packageName: string;
  methods: Method[];
  modeledMethods: Record<string, ModeledMethod>;
  modifiedSignatures: Set<string>;
  inProgressMethods: InProgressMethods;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  revealedMethodSignature: string | null;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModeledMethodDataGrid = ({
  packageName,
  methods,
  modeledMethods,
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
      const modeledMethod = modeledMethods[method.signature];
      const methodIsUnsaved = modifiedSignatures.has(method.signature);
      const methodCanBeModeled =
        !method.supported ||
        (modeledMethod && modeledMethod?.type !== "none") ||
        methodIsUnsaved;

      if (methodCanBeModeled || !hideModeledMethods) {
        methodsWithModelability.push({ method, methodCanBeModeled });
      } else {
        numHiddenMethods += 1;
      }
    }
    return [methodsWithModelability, numHiddenMethods];
  }, [hideModeledMethods, methods, modeledMethods, modifiedSignatures]);

  const someMethodsAreVisible = methodsWithModelability.length > 0;

  return (
    <VSCodeDataGrid gridTemplateColumns={GRID_TEMPLATE_COLUMNS}>
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
          </VSCodeDataGridRow>
          {methodsWithModelability.map(({ method, methodCanBeModeled }) => (
            <MethodRow
              key={method.signature}
              method={method}
              methodCanBeModeled={methodCanBeModeled}
              modeledMethod={modeledMethods[method.signature]}
              methodIsUnsaved={modifiedSignatures.has(method.signature)}
              modelingInProgress={inProgressMethods.hasMethod(
                packageName,
                method.signature,
              )}
              viewState={viewState}
              revealedMethodSignature={revealedMethodSignature}
              onChange={onChange}
            />
          ))}
        </>
      )}
      <HiddenMethodsRow
        numHiddenMethods={numHiddenMethods}
        someMethodsAreVisible={someMethodsAreVisible}
      />
    </VSCodeDataGrid>
  );
};
