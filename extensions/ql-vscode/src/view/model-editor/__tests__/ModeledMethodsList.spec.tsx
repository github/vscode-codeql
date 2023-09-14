import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/data-extension/method-factories";
import { InProgressMethods } from "../../../model-editor/shared/in-progress-methods";
import { createMockExtensionPack } from "../../../../test/factories/model-editor/extension-pack";
import { Mode } from "../../../model-editor/shared/mode";
import { ModelEditorViewState } from "../../../model-editor/shared/view-state";
import {
  ModeledMethodsList,
  ModeledMethodsListProps,
} from "../ModeledMethodsList";

describe(ModeledMethodsList.name, () => {
  const method1 = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
  });
  const method2 = createMethod({
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Query#executeScalar(Class)",
    packageName: "org.sql2o",
    typeName: "Query",
    methodName: "executeScalar",
    methodParameters: "(Class)",
  });
  const method3 = createMethod({
    library: "rt",
    libraryVersion: "",
    signature: "java.io.PrintStream#println(String)",
    packageName: "java.io",
    typeName: "PrintStream",
    methodName: "println",
    methodParameters: "(String)",
  });
  const onChange = jest.fn();
  const onSaveModelClick = jest.fn();
  const onGenerateFromLlmClick = jest.fn();
  const onStopGenerateFromLlmClick = jest.fn();
  const onModelDependencyClick = jest.fn();

  const viewState: ModelEditorViewState = {
    mode: Mode.Application,
    showFlowGeneration: false,
    showLlmButton: false,
    extensionPack: createMockExtensionPack(),
  };

  const render = (props: Partial<ModeledMethodsListProps> = {}) =>
    reactRender(
      <ModeledMethodsList
        methods={[method1, method2, method3]}
        modeledMethods={{
          [method1.signature]: {
            ...method1,
            type: "sink",
            input: "Argument[0]",
            output: "",
            kind: "jndi-injection",
            provenance: "df-generated",
          },
        }}
        modifiedSignatures={new Set([method1.signature])}
        inProgressMethods={new InProgressMethods()}
        viewState={viewState}
        hideModeledMethods={false}
        onChange={onChange}
        onSaveModelClick={onSaveModelClick}
        onGenerateFromLlmClick={onGenerateFromLlmClick}
        onStopGenerateFromLlmClick={onStopGenerateFromLlmClick}
        onGenerateFromSourceClick={jest.fn()}
        onModelDependencyClick={onModelDependencyClick}
        {...props}
      />,
    );

  it("renders the rows", () => {
    render();

    expect(screen.getByText("sql2o@1.6.0")).toBeInTheDocument();
    expect(screen.getByText("Java Runtime")).toBeInTheDocument();
  });
});
