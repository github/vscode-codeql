import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    render({
      modelingStatus: "saved",
      method: createMethod(),
    });

    expect(screen.getByText("API or Method")).toBeInTheDocument();
  });
});
