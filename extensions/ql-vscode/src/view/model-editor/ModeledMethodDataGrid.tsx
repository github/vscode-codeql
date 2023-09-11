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
import { Mode } from "../../model-editor/shared/mode";
import { sortMethods } from "../../model-editor/shared/sorting";
import { InProgressMethods } from "../../model-editor/shared/in-progress-methods";
import { HiddenMethodsRow } from "./HiddenMethodsRow";

export const GRID_TEMPLATE_COLUMNS = "0.5fr 0.125fr 0.125fr 0.125fr 0.125fr";

type Props = {
  packageName: string;
  methods: Method[];
  modeledMethods: Record<string, ModeledMethod>;
  modifiedSignatures: Set<string>;
  inProgressMethods: InProgressMethods;
  mode: Mode;
  hideModeledApis: boolean;
  onChange: (method: Method, modeledMethod: ModeledMethod) => void;
};

export const ModeledMethodDataGrid = ({
  packageName,
  methods,
  modeledMethods,
  modifiedSignatures,
  inProgressMethods,
  mode,
  hideModeledApis,
  onChange,
}: Props) => {
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

      if (methodCanBeModeled || !hideModeledApis) {
        methodsWithModelability.push({ method, methodCanBeModeled });
      } else {
        numHiddenMethods += 1;
      }
    }
    return [methodsWithModelability, numHiddenMethods];
  }, [hideModeledApis, methods, modeledMethods, modifiedSignatures]);

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
              mode={mode}
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
