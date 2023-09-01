import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { ExternalApiUsageName } from "../ExternalApiUsageName";
import { Method } from "../../../model-editor/method";
import { createMethod } from "../../../../test/factories/data-extension/method-factories";

describe(ExternalApiUsageName.name, () => {
  const render = (props: Method) =>
    reactRender(<ExternalApiUsageName {...props} />);

  it("renders method name", () => {
    const apiUsage = createMethod();
    render(apiUsage);

    const name = `${apiUsage.packageName}.${apiUsage.typeName}.${apiUsage.methodName}${apiUsage.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });
});
