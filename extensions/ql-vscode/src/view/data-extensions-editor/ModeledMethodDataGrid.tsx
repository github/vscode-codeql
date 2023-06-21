import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { useMemo } from "react";
import { Mode } from "../../data-extensions-editor/shared/mode";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  mode: Mode;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodDataGrid = ({
  externalApiUsages,
  modeledMethods,
  mode,
  onChange,
}: Props) => {
  const sortedExternalApiUsages = useMemo(() => {
    const sortedExternalApiUsages = [...externalApiUsages];
    sortedExternalApiUsages.sort((a, b) => {
      // Sort first by supported, putting unmodeled methods first.
      if (a.supported && !b.supported) {
        return 1;
      }
      if (!a.supported && b.supported) {
        return -1;
      }
      // Then sort by number of usages descending
      return b.usages.length - a.usages.length;
    });
    return sortedExternalApiUsages;
  }, [externalApiUsages]);

  return (
    <VSCodeDataGrid>
      <VSCodeDataGridRow rowType="header">
        <VSCodeDataGridCell cellType="columnheader" gridColumn={1}>
          Type
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={2}>
          Method
        </VSCodeDataGridCell>
        {mode === Mode.Application && (
          <VSCodeDataGridCell cellType="columnheader" gridColumn={3}>
            Usages
          </VSCodeDataGridCell>
        )}
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
      {sortedExternalApiUsages.map((externalApiUsage) => (
        <MethodRow
          key={externalApiUsage.signature}
          externalApiUsage={externalApiUsage}
          modeledMethod={modeledMethods[externalApiUsage.signature]}
          mode={mode}
          onChange={onChange}
        />
      ))}
    </VSCodeDataGrid>
  );
};
