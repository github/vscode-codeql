import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { MethodName } from "../MethodName";
import { Method } from "../../../model-editor/method";
import { createMethod } from "../../../../test/factories/data-extension/method-factories";

describe(MethodName.name, () => {
  const render = (props: Method) => reactRender(<MethodName {...props} />);

  it("renders method name", () => {
    const method = createMethod();
    render(method);

    const name = `${method.packageName}.${method.typeName}.${method.methodName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });
});
