import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { LibraryRow, LibraryRowProps } from "../LibraryRow";
import { InProgressMethods } from "../../../model-editor/shared/in-progress-methods";
import { createMockExtensionPack } from "../../../../test/factories/model-editor/extension-pack";
import { Mode } from "../../../model-editor/shared/mode";
import { ModelEditorViewState } from "../../../model-editor/shared/view-state";
import userEvent from "@testing-library/user-event";

describe(LibraryRow.name, () => {
  const method = createMethod();
  const onChange = jest.fn();
  const onSaveModelClick = jest.fn();
  const onGenerateFromLlmClick = jest.fn();
  const onStopGenerateFromLlmClick = jest.fn();
  const onModelDependencyClick = jest.fn();

  const viewState: ModelEditorViewState = {
    mode: Mode.Application,
    showFlowGeneration: false,
    showLlmButton: false,
    showMultipleModels: false,
    extensionPack: createMockExtensionPack(),
  };

  const render = (props: Partial<LibraryRowProps> = {}) =>
    reactRender(
      <LibraryRow
        title="sql2o"
        libraryVersion="1.6.0"
        methods={[method]}
        modeledMethods={{
          [method.signature]: {
            ...method,
            type: "sink",
            input: "Argument[0]",
            output: "",
            kind: "jndi-injection",
            provenance: "df-generated",
          },
        }}
        modifiedSignatures={new Set([method.signature])}
        inProgressMethods={new InProgressMethods()}
        viewState={viewState}
        hideModeledMethods={false}
        revealedMethodSignature={null}
        onChange={onChange}
        onSaveModelClick={onSaveModelClick}
        onGenerateFromLlmClick={onGenerateFromLlmClick}
        onStopGenerateFromLlmClick={onStopGenerateFromLlmClick}
        onGenerateFromSourceClick={jest.fn()}
        onModelDependencyClick={onModelDependencyClick}
        {...props}
      />,
    );

  it("renders the row", () => {
    render();

    expect(screen.queryByText("sql2o@1.6.0")).toBeInTheDocument();
    expect(screen.queryByText("Model from source")).not.toBeInTheDocument();
    expect(screen.queryByText("Model with AI")).not.toBeInTheDocument();
    expect(screen.queryByText("Model dependency")).toBeInTheDocument();
  });

  it("renders the row when flow generation is enabled", () => {
    render({
      viewState: {
        ...viewState,
        showFlowGeneration: true,
      },
    });

    expect(screen.queryByText("Model from source")).toBeInTheDocument();
    expect(screen.queryByText("Model with AI")).not.toBeInTheDocument();
    expect(screen.queryByText("Model dependency")).toBeInTheDocument();
  });

  it("renders the row when LLM is enabled", () => {
    render({
      viewState: {
        ...viewState,
        showLlmButton: true,
      },
    });

    expect(screen.queryByText("Model from source")).not.toBeInTheDocument();
    expect(screen.queryByText("Model with AI")).toBeInTheDocument();
    expect(screen.queryByText("Model dependency")).toBeInTheDocument();
  });

  it("renders the row when flow generation and LLM are enabled", () => {
    render({
      viewState: {
        ...viewState,
        showFlowGeneration: true,
        showLlmButton: true,
      },
    });

    expect(screen.queryByText("Model from source")).toBeInTheDocument();
    expect(screen.queryByText("Model with AI")).toBeInTheDocument();
    expect(screen.queryByText("Model dependency")).toBeInTheDocument();
  });

  it("can expand the row", async () => {
    render();

    expect(screen.queryByText("Save")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /sql2o@1.6.0/,
      }),
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
