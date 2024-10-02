import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import type { LibraryRowProps } from "../LibraryRow";
import { LibraryRow } from "../LibraryRow";
import { userEvent } from "@testing-library/user-event";
import { createMockModelEditorViewState } from "../../../../test/factories/model-editor/view-state";

describe(LibraryRow.name, () => {
  const method = createMethod();
  const onChange = jest.fn();
  const onMethodClick = jest.fn();
  const onSaveModelClick = jest.fn();
  const onModelDependencyClick = jest.fn();

  const viewState = createMockModelEditorViewState();

  const render = (props: Partial<LibraryRowProps> = {}) =>
    reactRender(
      <LibraryRow
        title="sql2o"
        libraryVersion="1.6.0"
        methods={[method]}
        modeledMethodsMap={{
          [method.signature]: [
            {
              ...method,
              type: "sink",
              input: "Argument[0]",
              kind: "jndi-injection",
              provenance: "df-generated",
            },
          ],
        }}
        modifiedSignatures={new Set([method.signature])}
        selectedSignatures={new Set()}
        evaluationRun={undefined}
        viewState={viewState}
        hideModeledMethods={false}
        revealedMethodSignature={null}
        onChange={onChange}
        onMethodClick={onMethodClick}
        onSaveModelClick={onSaveModelClick}
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

  it("renders the row when generate button is enabled", () => {
    render({
      viewState: {
        ...viewState,
        showGenerateButton: true,
      },
    });

    expect(screen.queryByText("Model from source")).toBeInTheDocument();
    expect(screen.queryByText("Model with AI")).not.toBeInTheDocument();
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
