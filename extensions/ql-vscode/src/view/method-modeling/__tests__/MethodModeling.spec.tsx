import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodModeling, MethodModelingProps } from "../MethodModeling";
import { createExternalApiUsage } from "../../../../test/factories/data-extension/external-api-factories";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    render({
      modelingStatus: "saved",
      externalApiUsage: createExternalApiUsage(),
    });

    expect(screen.getByText("API or Method")).toBeInTheDocument();
  });
});
