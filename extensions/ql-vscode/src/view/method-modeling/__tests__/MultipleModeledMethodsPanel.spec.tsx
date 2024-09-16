import { render as reactRender, screen, waitFor } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import {
  createNoneModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
} from "../../../../test/factories/model-editor/modeled-method-factories";
import type { MultipleModeledMethodsPanelProps } from "../MultipleModeledMethodsPanel";
import { MultipleModeledMethodsPanel } from "../MultipleModeledMethodsPanel";
import { userEvent } from "@testing-library/user-event";
import type { ModeledMethod } from "../../../model-editor/modeled-method";
import { QueryLanguage } from "../../../common/query-language";
import { defaultModelConfig } from "../../../model-editor/languages";

describe(MultipleModeledMethodsPanel.name, () => {
  const language = QueryLanguage.Java;
  const method = createMethod();
  const onChange = jest.fn<void, [string, ModeledMethod[]]>();
  const modelConfig = defaultModelConfig;

  const baseProps = {
    language,
    method,
    modelConfig,
    onChange,
  };

  const createRender =
    (modeledMethods: ModeledMethod[]) =>
    (props: Partial<MultipleModeledMethodsPanelProps> = {}) =>
      reactRender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={modeledMethods}
          {...props}
        />,
      );

  describe("with no modeled methods", () => {
    const modeledMethods: ModeledMethod[] = [];

    const render = createRender(modeledMethods);

    it("renders the method modeling inputs once", () => {
      render();

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("none");
    });

    it("disables all pagination", () => {
      render();

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
      render();

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
      createSinkModeledMethod({
        ...method,
        type: "sink",
        input: "Argument[this]",
        kind: "path-injection",
      }),
    ];

    const render = createRender(modeledMethods);

    it("renders the method modeling inputs once", () => {
      render();

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("sink");
    });

    it("disables all pagination", () => {
      render();

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
      render();

      expect(
        screen
          .getByLabelText("Delete modeling")
          .getElementsByTagName("input")[0],
      ).toBeDisabled();
    });

    it("can add modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith(method.signature, [
        ...modeledMethods,
        {
          signature: method.signature,
          endpointType: method.endpointType,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
        },
      ] satisfies ModeledMethod[]);
    });

    it("changes selection to the newly added modeling", async () => {
      const { rerender } = render();

      await userEvent.click(screen.getByLabelText("Add modeling"));

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][1]
          }
        />,
      );

      expect(screen.getByText("2/2")).toBeInTheDocument();
    });
  });

  describe("with two modeled methods", () => {
    const modeledMethods = [
      createSinkModeledMethod({
        ...method,
      }),
      createSourceModeledMethod({
        ...method,
      }),
    ];

    const render = createRender(modeledMethods);

    it("renders the method modeling inputs once", () => {
      render();

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("sink");
    });

    it("renders the pagination", () => {
      render();

      expect(screen.getByLabelText("Previous modeling")).toBeInTheDocument();
      expect(screen.getByLabelText("Next modeling")).toBeInTheDocument();
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });

    it("disables the correct pagination", async () => {
      render();

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
      render();

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

    it("correctly updates selected pagination index when the number of models decreases", async () => {
      const { rerender } = render();

      await userEvent.click(screen.getByLabelText("Next modeling"));

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={[modeledMethods[1]]}
        />,
      );

      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(
        screen.getByRole("combobox", {
          name: "Model type",
        }),
      ).toHaveValue("source");
    });

    it("does not show errors", () => {
      render();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("can update the first modeling", async () => {
      render();

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "source");

      expect(onChange).toHaveBeenCalledWith(method.signature, [
        {
          signature: method.signature,
          endpointType: method.endpointType,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "source",
          output: "ReturnValue",
          kind: "value",
          provenance: "manual",
        },
        ...modeledMethods.slice(1),
      ] satisfies ModeledMethod[]);
    });

    it("can update the second modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Next modeling"));

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "sink");

      expect(onChange).toHaveBeenCalledWith(method.signature, [
        ...modeledMethods.slice(0, 1),
        {
          signature: method.signature,
          endpointType: method.endpointType,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "sink",
          input: "Argument[this]",
          kind: "value",
          provenance: "manual",
        },
      ] satisfies ModeledMethod[]);
    });

    it("can delete modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(
        method.signature,
        modeledMethods.slice(1),
      );
    });

    it("can add modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith(method.signature, [
        ...modeledMethods,
        {
          signature: method.signature,
          endpointType: method.endpointType,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
        },
      ] satisfies ModeledMethod[]);
    });

    it("shows an error when adding a neutral modeling", async () => {
      const { rerender } = render();

      await userEvent.click(screen.getByLabelText("Add modeling"));

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][1]
          }
        />,
      );

      const modelTypeDropdown = screen.getByRole("combobox", {
        name: "Model type",
      });

      await userEvent.selectOptions(modelTypeDropdown, "neutral");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][1]
          }
        />,
      );

      const kindDropdown = screen.getByRole("combobox", {
        name: "Kind",
      });

      await userEvent.selectOptions(kindDropdown, "source");

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][1]
          }
        />,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText("Error: Conflicting classification"),
      ).toBeInTheDocument();
    });

    it("changes selection to the newly added modeling", async () => {
      const { rerender } = render();

      expect(screen.getByText("1/2")).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText("Add modeling"));

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={
            onChange.mock.calls[onChange.mock.calls.length - 1][1]
          }
        />,
      );

      expect(screen.getByText("3/3")).toBeInTheDocument();
    });
  });

  describe("with three modeled methods", () => {
    const modeledMethods = [
      createSinkModeledMethod({
        ...method,
        input: "Argument[this]",
        kind: "path-injection",
      }),
      createSourceModeledMethod({
        ...method,
        output: "ReturnValue",
        kind: "remote",
      }),
      createSourceModeledMethod({
        ...method,
        output: "ReturnValue",
        kind: "local",
      }),
    ];

    const render = createRender(modeledMethods);

    it("can use the pagination", async () => {
      render();

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

    it("preserves selection when a modeling other than the selected modeling is removed", async () => {
      const { rerender } = render();

      expect(screen.getByText("1/3")).toBeInTheDocument();

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={modeledMethods.slice(0, 2)}
        />,
      );

      expect(screen.getByText("1/2")).toBeInTheDocument();
    });

    it("reduces selection when the selected modeling is removed", async () => {
      const { rerender } = render();

      await userEvent.click(screen.getByLabelText("Next modeling"));
      await userEvent.click(screen.getByLabelText("Next modeling"));
      expect(screen.getByText("3/3")).toBeInTheDocument();

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={modeledMethods.slice(0, 2)}
        />,
      );

      expect(screen.getByText("2/2")).toBeInTheDocument();
    });
  });

  describe("with 1 modeled and 1 unmodeled method", () => {
    const modeledMethods = [
      createSinkModeledMethod({
        ...method,
        type: "sink",
        input: "Argument[this]",
        kind: "path-injection",
      }),
      createNoneModeledMethod({
        ...method,
      }),
    ];

    const render = createRender(modeledMethods);

    it("can add modeling", () => {
      render();

      expect(
        screen.getByLabelText("Add modeling").getElementsByTagName("input")[0],
      ).toBeEnabled();
    });

    it("can delete first modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(
        method.signature,
        modeledMethods.slice(1),
      );
    });

    it("can delete second modeling", async () => {
      render();

      await userEvent.click(screen.getByLabelText("Next modeling"));
      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(
        method.signature,
        modeledMethods.slice(0, 1),
      );
    });

    it("can add modeling after deleting second modeling", async () => {
      const { rerender } = render();

      await userEvent.click(screen.getByLabelText("Next modeling"));
      await userEvent.click(screen.getByLabelText("Delete modeling"));

      expect(onChange).toHaveBeenCalledWith(
        method.signature,
        modeledMethods.slice(0, 1),
      );

      rerender(
        <MultipleModeledMethodsPanel
          {...baseProps}
          modeledMethods={modeledMethods.slice(0, 1)}
        />,
      );

      onChange.mockReset();
      await userEvent.click(screen.getByLabelText("Add modeling"));

      expect(onChange).toHaveBeenCalledWith(method.signature, [
        ...modeledMethods.slice(0, 1),
        {
          signature: method.signature,
          endpointType: method.endpointType,
          packageName: method.packageName,
          typeName: method.typeName,
          methodName: method.methodName,
          methodParameters: method.methodParameters,
          type: "none",
        },
      ] satisfies ModeledMethod[]);
    });
  });

  describe("with duplicate modeled methods", () => {
    const modeledMethods = [
      createSinkModeledMethod({
        ...method,
      }),
      createSinkModeledMethod({
        ...method,
      }),
    ];

    const render = createRender(modeledMethods);

    it("shows errors", () => {
      render();

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("shows the correct error message", async () => {
      render();

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
