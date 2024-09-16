import { render as reactRender, screen } from "@testing-library/react";
import type { MethodModelingProps } from "../MethodModeling";
import { MethodModeling } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createSinkModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";
import { defaultModelConfig } from "../../../model-editor/languages";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    const method = createMethod();
    const modeledMethod = createSinkModeledMethod();
    const onChange = jest.fn();

    render({
      language: QueryLanguage.Java,
      modelConfig: defaultModelConfig,
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
