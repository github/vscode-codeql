import { useCallback, useEffect, useState } from "react";

import type { Meta, StoryFn } from "@storybook/react";

import { MethodRow as MethodRowComponent } from "../../view/model-editor/MethodRow";
import type { Method } from "../../model-editor/method";
import { EndpointType, CallClassification } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS } from "../../view/model-editor/ModeledMethodDataGrid";
import { DataGrid } from "../../view/common/DataGrid";
import { createMockModelEditorViewState } from "../../../test/factories/model-editor/view-state";

export default {
  title: "CodeQL Model Editor/Method Row",
  component: MethodRowComponent,
} as Meta<typeof MethodRowComponent>;

const Template: StoryFn<typeof MethodRowComponent> = (args) => {
  const [modeledMethods, setModeledMethods] = useState<ModeledMethod[]>(
    args.modeledMethods,
  );

  useEffect(() => {
    setModeledMethods(args.modeledMethods);
  }, [args.modeledMethods]);

  const handleChange = useCallback(
    (methodSignature: string, modeledMethods: ModeledMethod[]) => {
      args.onChange(methodSignature, modeledMethods);
      setModeledMethods(modeledMethods);
    },
    [args],
  );

  return (
    <DataGrid gridTemplateColumns={MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS}>
      <MethodRowComponent
        {...args}
        modeledMethods={modeledMethods}
        onChange={handleChange}
      />
    </DataGrid>
  );
};

const method: Method = {
  library: "sql2o-1.6.0.jar",
  signature: "org.sql2o.Sql2o#open()",
  endpointType: EndpointType.Method,
  packageName: "org.sql2o",
  typeName: "Sql2o",
  methodName: "open",
  methodParameters: "()",
  supported: false,
  supportedType: "none",
  usages: [
    {
      label: "open(...)",
      url: {
        type: "lineColumnLocation",
        uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
        startLine: 14,
        startColumn: 24,
        endLine: 14,
        endColumn: 35,
      },
      classification: CallClassification.Source,
    },
    {
      label: "open(...)",
      url: {
        type: "lineColumnLocation",
        uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
        startLine: 25,
        startColumn: 24,
        endLine: 25,
        endColumn: 35,
      },
      classification: CallClassification.Source,
    },
  ],
};
const modeledMethod: ModeledMethod = {
  type: "summary",
  input: "Argument[this]",
  output: "ReturnValue",
  kind: "taint",
  provenance: "manual",
  signature: "org.sql2o.Sql2o#open()",
  endpointType: EndpointType.Method,
  packageName: "org.sql2o",
  typeName: "Sql2o",
  methodName: "open",
  methodParameters: "()",
};

const viewState = createMockModelEditorViewState({
  showGenerateButton: true,
});

export const Unmodeled = Template.bind({});
Unmodeled.args = {
  method,
  modeledMethods: [],
  methodCanBeModeled: true,
  viewState,
};

export const Source = Template.bind({});
Source.args = {
  method,
  modeledMethods: [{ ...modeledMethod, type: "source" }],
  methodCanBeModeled: true,
  viewState,
};

export const Sink = Template.bind({});
Sink.args = {
  method,
  modeledMethods: [{ ...modeledMethod, type: "sink" }],
  methodCanBeModeled: true,
  viewState,
};

export const Summary = Template.bind({});
Summary.args = {
  method,
  modeledMethods: [{ ...modeledMethod, type: "summary" }],
  methodCanBeModeled: true,
  viewState,
};

export const Neutral = Template.bind({});
Neutral.args = {
  method,
  modeledMethods: [{ ...modeledMethod, type: "neutral" }],
  methodCanBeModeled: true,
  viewState,
};

export const AlreadyModeled = Template.bind({});
AlreadyModeled.args = {
  method: { ...method, supported: true },
  modeledMethods: [],
  viewState,
};

export const MultipleModelings = Template.bind({});
MultipleModelings.args = {
  method,
  modeledMethods: [
    { ...modeledMethod, type: "source" },
    { ...modeledMethod, type: "sink" },
    { ...modeledMethod },
  ],
  methodCanBeModeled: true,
  viewState,
};

export const ValidationError = Template.bind({});
ValidationError.args = {
  method,
  modeledMethods: [
    { ...modeledMethod, type: "source" },
    { ...modeledMethod, type: "source" },
  ],
  methodCanBeModeled: true,
  viewState,
};

export const MultipleValidationErrors = Template.bind({});
MultipleValidationErrors.args = {
  method,
  modeledMethods: [
    { ...modeledMethod, type: "source" },
    { ...modeledMethod, type: "source" },
    { ...modeledMethod, type: "sink" },
    { ...modeledMethod, type: "sink" },
    { ...modeledMethod, type: "neutral", kind: "source" },
  ],
  methodCanBeModeled: true,
  viewState,
};
