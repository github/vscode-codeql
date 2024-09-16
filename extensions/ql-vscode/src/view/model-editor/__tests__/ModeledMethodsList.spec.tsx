import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import type { ModeledMethodsListProps } from "../ModeledMethodsList";
import { ModeledMethodsList } from "../ModeledMethodsList";
import { createMockModelEditorViewState } from "../../../../test/factories/model-editor/view-state";

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
  const onMethodClick = jest.fn();
  const onSaveModelClick = jest.fn();
  const onModelDependencyClick = jest.fn();

  const viewState = createMockModelEditorViewState();

  const render = (props: Partial<ModeledMethodsListProps> = {}) =>
    reactRender(
      <ModeledMethodsList
        methods={[method1, method2, method3]}
        modeledMethodsMap={{
          [method1.signature]: [
            {
              ...method1,
              type: "sink",
              input: "Argument[0]",
              kind: "jndi-injection",
              provenance: "df-generated",
            },
          ],
        }}
        modifiedSignatures={new Set([method1.signature])}
        selectedSignatures={new Set()}
        evaluationRun={undefined}
        viewState={viewState}
        hideModeledMethods={false}
        revealedMethodSignature={null}
        onChange={onChange}
        onMethodClick={onMethodClick}
        onSaveModelClick={onSaveModelClick}
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
