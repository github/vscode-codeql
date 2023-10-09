import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import {
  ModeledMethodsPanel,
  ModeledMethodsPanelProps,
} from "../ModeledMethodsPanel";

describe(ModeledMethodsPanel.name, () => {
  const render = (props: ModeledMethodsPanelProps) =>
    reactRender(<ModeledMethodsPanel {...props} />);

  const method = createMethod();
  const modeledMethods = [createModeledMethod(), createModeledMethod()];
  const onChange = jest.fn();

  describe("when show multiple models is disabled", () => {
    const showMultipleModels = false;

    it("renders the method modeling inputs", () => {
      render({
        method,
        modeledMethods,
        onChange,
        showMultipleModels,
      });

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
    });

    it("does not render the pagination", () => {
      render({
        method,
        modeledMethods,
        onChange,
        showMultipleModels,
      });

      expect(
        screen.queryByLabelText("Previous modeling"),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Next modeling")).not.toBeInTheDocument();
    });
  });

  describe("when show multiple models is enabled", () => {
    const showMultipleModels = true;

    it("renders the method modeling inputs once", () => {
      render({
        method,
        modeledMethods,
        onChange,
        showMultipleModels,
      });

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
    });

    it("renders the pagination", () => {
      render({
        method,
        modeledMethods,
        onChange,
        showMultipleModels,
      });

      expect(screen.getByLabelText("Previous modeling")).toBeInTheDocument();
      expect(screen.getByLabelText("Next modeling")).toBeInTheDocument();
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });
  });
});
