import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createSinkModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import {
  ModeledMethodsPanel,
  ModeledMethodsPanelProps,
} from "../ModeledMethodsPanel";
import { QueryLanguage } from "../../../common/query-language";

describe(ModeledMethodsPanel.name, () => {
  const render = (props: ModeledMethodsPanelProps) =>
    reactRender(<ModeledMethodsPanel {...props} />);

  const language = QueryLanguage.Java;
  const method = createMethod();
  const modeledMethods = [createSinkModeledMethod(), createSinkModeledMethod()];
  const modelingStatus = "unmodeled";
  const isModelingInProgress = false;
  const onChange = jest.fn();

  it("renders the method modeling inputs once", () => {
    render({
      language,
      method,
      modeledMethods,
      isModelingInProgress,
      modelingStatus,
      onChange,
    });

    expect(screen.getAllByRole("combobox")).toHaveLength(4);
  });

  it("renders the pagination", () => {
    render({
      language,
      method,
      modeledMethods,
      isModelingInProgress,
      modelingStatus,
      onChange,
    });

    expect(screen.getByLabelText("Previous modeling")).toBeInTheDocument();
    expect(screen.getByLabelText("Next modeling")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
});
