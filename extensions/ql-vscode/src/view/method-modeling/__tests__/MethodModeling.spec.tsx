import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    const method = createMethod();
    const modeledMethod = createModeledMethod();
    const onChange = jest.fn();

    render({
      modelingStatus: "saved",
      method,
      modeledMethods: [modeledMethod],
      onChange,
    });

    expect(
      screen.getByText(`${method.packageName}@${method.libraryVersion}`),
    ).toBeInTheDocument();
  });
});
