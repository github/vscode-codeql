import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { ExternalApiUsageName } from "../ExternalApiUsageName";
import { ExternalApiUsage } from "../../../model-editor/external-api-usage";
import { createExternalApiUsage } from "../../../../test/factories/data-extension/external-api-factories";

describe(ExternalApiUsageName.name, () => {
  const render = (props: ExternalApiUsage) =>
    reactRender(<ExternalApiUsageName {...props} />);

  it("renders method name", () => {
    const apiUsage = createExternalApiUsage();
    render(apiUsage);

    const name = `${apiUsage.packageName}.${apiUsage.typeName}.${apiUsage.methodName}${apiUsage.methodParameters}`;
    expect(screen.getByText(name)).toBeInTheDocument();
  });
});
