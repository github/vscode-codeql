import { render as reactRender, screen } from "@testing-library/react";
import { MethodName } from "../MethodName";
import type { Method } from "../../../model-editor/method";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";

describe(MethodName.name, () => {
  const render = (props: Method) => reactRender(<MethodName {...props} />);

  it("renders method name", () => {
    const method = createMethod();
    render(method);

    const name = `${method.packageName}.${method.typeName}.${method.methodName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("renders method name without package name", () => {
    const method = createMethod({
      packageName: "",
    });
    render(method);

    const name = `${method.typeName}.${method.methodName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("renders method name without method name but with parameters", () => {
    const method = createMethod({
      packageName: "",
      methodName: "",
    });
    render(method);

    const name = `${method.typeName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("renders method name without method name and parameters", () => {
    const method = createMethod({
      packageName: "",
      methodName: "",
      methodParameters: "",
    });
    render(method);

    const name = `${method.typeName}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("renders method name without package and type name", () => {
    const method = createMethod({
      packageName: "",
      typeName: "",
    });
    render(method);

    const name = `${method.methodName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("renders method name without type name", () => {
    const method = createMethod({
      typeName: "",
    });
    render(method);

    const name = `${method.packageName}.${method.methodName}${method.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });
});
