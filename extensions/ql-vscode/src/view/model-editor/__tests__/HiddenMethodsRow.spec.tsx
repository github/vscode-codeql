import * as React from "react";
import { render, screen } from "@testing-library/react";
import { HiddenMethodsRow } from "../HiddenMethodsRow";
import { createMockExtensionPack } from "../../../../test/factories/model-editor/extension-pack";
import { ModelEditorViewState } from "../../../model-editor/shared/view-state";
import { Mode } from "../../../model-editor/shared/mode";

describe(HiddenMethodsRow.name, () => {
  const viewState: ModelEditorViewState = {
    mode: Mode.Application,
    showFlowGeneration: false,
    showLlmButton: false,
    showMultipleModels: false,
    extensionPack: createMockExtensionPack(),
    sourceArchiveAvailable: true,
  };

  it("does not render with 0 hidden methods", () => {
    const { container } = render(
      <HiddenMethodsRow
        numHiddenMethods={0}
        someMethodsAreVisible={true}
        viewState={viewState}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders with 1 hidden methods and no visible methods", () => {
    render(
      <HiddenMethodsRow
        numHiddenMethods={1}
        someMethodsAreVisible={false}
        viewState={viewState}
      />,
    );

    expect(
      screen.getByText("1 method modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 1 hidden methods and visible methods", () => {
    render(
      <HiddenMethodsRow
        numHiddenMethods={1}
        someMethodsAreVisible={true}
        viewState={viewState}
      />,
    );

    expect(
      screen.getByText("And 1 method modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 3 hidden methods and no visible methods", () => {
    render(
      <HiddenMethodsRow
        numHiddenMethods={3}
        someMethodsAreVisible={false}
        viewState={viewState}
      />,
    );

    expect(
      screen.getByText("3 methods modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 3 hidden methods and visible methods", () => {
    render(
      <HiddenMethodsRow
        numHiddenMethods={3}
        someMethodsAreVisible={true}
        viewState={viewState}
      />,
    );

    expect(
      screen.getByText("And 3 methods modeled in other CodeQL packs"),
    ).toBeVisible();
  });
});
