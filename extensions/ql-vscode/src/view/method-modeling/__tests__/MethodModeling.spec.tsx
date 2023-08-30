import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method name", () => {
    render({ modelingStatus: "saved" });

    expect(screen.getByText("that.dependency.THENAME")).toBeInTheDocument();
  });
});
