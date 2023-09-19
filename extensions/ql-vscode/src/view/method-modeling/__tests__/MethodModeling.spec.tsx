import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/data-extension/method-factories";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    const method = createMethod();

    render({
      modelingStatus: "saved",
      method,
    });

    expect(
      screen.getByText(`${method.packageName}@${method.libraryVersion}`),
    ).toBeInTheDocument();
  });
});
