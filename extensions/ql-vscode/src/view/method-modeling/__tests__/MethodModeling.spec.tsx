import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    const method = createMethod();
    const modeledMethod = createModeledMethod();
    const isModelingInProgress = false;
    const onChange = jest.fn();

    render({
      language: QueryLanguage.Java,
      modelingStatus: "saved",
      method,
      modeledMethods: [modeledMethod],
      isModelingInProgress,
      onChange,
    });

    expect(
      screen.getByText(`${method.packageName}@${method.libraryVersion}`),
    ).toBeInTheDocument();
  });
});
