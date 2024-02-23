import { render as reactRender, screen } from "@testing-library/react";
import type { MethodModelingProps } from "../MethodModeling";
import { MethodModeling } from "../MethodModeling";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createSinkModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";

describe(MethodModeling.name, () => {
  const render = (props: MethodModelingProps) =>
    reactRender(<MethodModeling {...props} />);

  it("renders method modeling panel", () => {
    const method = createMethod();
    const modeledMethod = createSinkModeledMethod();
    const isModelingInProgress = false;
    const isProcessedByAutoModel = false;
    const onChange = jest.fn();

    render({
      language: QueryLanguage.Java,
      isCanary: false,
      modelingStatus: "saved",
      method,
      modeledMethods: [modeledMethod],
      isModelingInProgress,
      isProcessedByAutoModel,
      onChange,
    });

    expect(
      screen.getByText(`${method.packageName}@${method.libraryVersion}`),
    ).toBeInTheDocument();
  });
});
