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
  const onChange = jest.fn<void, [ModeledMethod[]]>();

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

    it("cannot add or delete modeling", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Delete modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
      expect(
        screen.getByLabelText("Add modeling").getElementsByTagName("input")[0],
      ).toBeDisabled();
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

    it("cannot delete modeling", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen
          .getByLabelText("Delete modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
    });

    it("can add modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith([
        ...modeledMethods,
        {
          signature: method.signature,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
          input: "",
          output: "",
          kind: "",
          provenance: "manual",
        },
      ]);
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

    it("can update the first modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "source");

      expect(onChange).toHaveBeenCalledWith([
        {
          signature: method.signature,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "source",
          input: "Argument[this]",
          output: "ReturnValue",
          kind: "value",
          provenance: "manual",
        },
        ...modeledMethods.slice(1),
      ]);
    });

    it("can update the second modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Next modeling"));

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "sink");

      expect(onChange).toHaveBeenCalledWith([
        ...modeledMethods.slice(0, 1),
        {
          signature: method.signature,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "sink",
          input: "Argument[this]",
          output: "ReturnValue",
          kind: "value",
          provenance: "manual",
        },
      ]);
    });

    it("can delete modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(modeledMethods.slice(1));
    });

    it("can add modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith([
        ...modeledMethods,
        {
          signature: method.signature,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
          input: "",
          output: "",
          kind: "",
          provenance: "manual",
        },
      ]);
    });

    it("shows an error when adding a neutral modeling", async () => {
      const { rerender } = render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Add modeling"));

      rerender(
        <MultipleModeledMethodsPanel
          method={method}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][0]
          }
          onChange={onChange}
        />,
      );

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "neutral");

      rerender(
        <MultipleModeledMethodsPanel
          method={method}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][0]
          }
          onChange={onChange}
        />,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText("Error: Conflicting classification"),
      ).toBeInTheDocument();
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

  describe("with 1 modeled and 1 unmodeled method", () => {
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
        type: "none",
        input: "",
        output: "",
        kind: "",
      }),
    ];

    it("can add modeling", () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      expect(
        screen.getByLabelText("Add modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
    });

    it("can delete first modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(modeledMethods.slice(1));
    });

    it("can delete second modeling", async () => {
      render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Next modeling"));
      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(modeledMethods.slice(0, 1));
    });

    it("can add modeling after deleting second modeling", async () => {
      const { rerender } = render({
        method,
        modeledMethods,
        onChange,
      });

      await userEvent.click(screen.getByLabelText("Next modeling"));
      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(modeledMethods.slice(0, 1));

      rerender(
        <MultipleModeledMethodsPanel
          method={method}
          modeledMethods={modeledMethods.slice(0, 1)}
          onChange={onChange}
        />,
      );

      onChange.mockReset();
      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith([
        ...modeledMethods.slice(0, 1),
        {
          signature: method.signature,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
          input: "",
          output: "",
          kind: "",
          provenance: "manual",
        },
      ]);
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
