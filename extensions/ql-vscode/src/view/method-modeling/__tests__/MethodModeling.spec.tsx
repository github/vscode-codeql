import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling } from "../MethodModeling";

describe(MethodModeling.name, () => {
  const render = () => reactRender(<MethodModeling />);

  it("renders data flow paths", () => {
    render();

    expect(screen.getByText("that.dependency.THENAME")).toBeInTheDocument();
  });
});
