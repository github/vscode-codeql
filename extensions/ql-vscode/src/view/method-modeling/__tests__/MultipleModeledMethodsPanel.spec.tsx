import * as React from "react";
import { render as reactRender, screen, waitFor } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import {
  MultipleModeledMethodsPanel,
  MultipleModeledMethodsPanelProps,
} from "../MultipleModeledMethodsPanel";
import userEvent from "@testing-library/user-event";
import { ModeledMethod } from "../../../model-editor/modeled-method";

describe(MultipleModeledMethodsPanel.name, () => {
  const render = (props: MultipleModeledMethodsPanelProps) =>
    reactRender(<MultipleModeledMethodsPanel {...props} />);

  const method = createMethod();
  const onChange = jest.fn();

  describe("with no modeled methods", () => {
    const modeledMethods: ModeledMethod[] = [];

    it("renders the method modeling inputs once", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("none");
    });

    it("disables all pagination", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(screen.queryByText("0/0")).not.toBeInTheDocument();
      expect(screen.queryByText("1/0")).not.toBeInTheDocument();
    });
  });

  describe("with one modeled method", () => {
    const modeledMethods = [
      createModeledMethod({
        ...method,
        type: "sink",
        input: "Argument[this]",
        output: "",
        kind: "path-injection",
      }),
    ];

    it("renders the method modeling inputs once", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("sink");
    });

    it("disables all pagination", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(screen.queryByText("1/1")).not.toBeInTheDocument();
    });
  });

  describe("with two modeled methods", () => {
    const modeledMethods = [
      createModeledMethod({
        ...method,
        type: "sink",
        input: "Argument[this]",
        output: "",
        kind: "path-injection",
      }),
      createModeledMethod({
        ...method,
        type: "source",
        input: "",
        output: "ReturnValue",
        kind: "remote",
      }),
    ];

    it("renders the method modeling inputs once", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("sink");
    });

    it("renders the pagination", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.getByLabelText("Previous modeling")).toBeInTheDocument();
      expect(screen.getByLabelText("Next modeling")).toBeInTheDocument();
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });

    it("disables the correct pagination", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
    });

    it("can use the pagination", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Next modeling"));

      await waitFor(() => {
        expect(
          screen
            .getByLabelText("Previous modeling")
            .getElementsByTagName("input")[0],
        ).toBeEnabled();
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(screen.getByText("2/2")).toBeInTheDocument();

      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("source");
    });

    it("does not show errors", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("with three modeled methods", () => {
    const modeledMethods = [
      createModeledMethod({
        ...method,
        type: "sink",
        input: "Argument[this]",
        output: "",
        kind: "path-injection",
      }),
      createModeledMethod({
        ...method,
        type: "source",
        input: "",
        output: "ReturnValue",
        kind: "remote",
      }),
      createModeledMethod({
        ...method,
        type: "source",
        input: "",
        output: "ReturnValue",
        kind: "local",
      }),
    ];

    it("can use the pagination", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(screen.getByText("1/3")).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText("Next modeling"));

      await waitFor(() => {
        expect(
          screen
            .getByLabelText("Previous modeling")
            .getElementsByTagName("input")[0],
        ).toBeEnabled();
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(screen.getByText("2/3")).toBeInTheDocument();

      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("source");

      await userEvent.click(screen.getByLabelText("Next modeling"));

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(screen.getByText("3/3")).toBeInTheDocument();

      expect(
        screen.getByRole("combobox", {
          name: "Kind",
        }),
      ).toHaveValue("local");

      await userEvent.click(screen.getByLabelText("Previous modeling"));

      await waitFor(() => {
        expect(
          screen
            .getByLabelText("Next modeling")
            .getElementsByTagName("input")[0],
        ).toBeEnabled();
      });

      expect(
        screen
          .getByLabelText("Previous modeling")
          .getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(
        screen.getByLabelText("Next modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
      expect(screen.getByText("2/3")).toBeInTheDocument();

      expect(
        screen.getByRole("combobox", {
          name: "Kind",
        }),
      ).toHaveValue("remote");
    });
  });

  describe("with duplicate modeled methods", () => {
    const modeledMethods = [
      createModeledMethod({
        ...method,
      }),
      createModeledMethod({
        ...method,
      }),
    ];

    it("shows errors", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("shows the correct error message", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen.getByText("Error: Duplicated classification"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "This method has two identical or conflicting classifications.",
        ),
      ).toBeInTheDocument();

      expect(screen.getByText("1/2")).toBeInTheDocument();

      const button = screen.getByText(
        "Modify or remove the duplicated classification.",
      );

      await userEvent.click(button);

      expect(screen.getByText("2/2")).toBeInTheDocument();

      expect(
        screen.getByText("Modify or remove the duplicated classification."),
      ).toBeInTheDocument();
    });
  });
});
