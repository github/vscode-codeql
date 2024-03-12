import { render as reactRender, screen } from "@testing-library/react";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";
import { createSummaryModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { createMockModelEditorViewState } from "../../../../test/factories/model-editor/view-state";
import type { Props } from "../ModelAlertsIndicator";
import { ModelAlertsIndicator } from "../ModelAlertsIndicator";
import { createMockVariantAnalysis } from "../../../../test/factories/variant-analysis/shared/variant-analysis";
import { VariantAnalysisStatus } from "../../../variant-analysis/shared/variant-analysis";

describe(ModelAlertsIndicator.name, () => {
  const method = createMethod();
  const modeledMethod = createSummaryModeledMethod(method);
  const evaluationRun = {
    isPreparing: false,
    variantAnalysis: createMockVariantAnalysis({
      status: VariantAnalysisStatus.Succeeded,
    }),
  };

  const render = (props: Partial<Props> = {}) =>
    reactRender(
      <ModelAlertsIndicator
        viewState={createMockModelEditorViewState({ showEvaluationUi: true })}
        modeledMethod={modeledMethod}
        evaluationRun={evaluationRun}
        {...props}
      />,
    );

  describe("when showEvaluationUi is false", () => {
    it("does not render anything", () => {
      render({
        viewState: createMockModelEditorViewState({ showEvaluationUi: false }),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("when there is no evaluation run", () => {
    it("does not render anything", () => {
      render({
        evaluationRun: undefined,
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("when there is no modeled method", () => {
    it("does not render anything", () => {
      render({
        modeledMethod: undefined,
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("when there is an evaluation run and a modeled method", () => {
    // TODO: Once we have alert provenance, this will be an actual alert count instead of a random number.
    it("renders a button with a random number", () => {
      render();

      const button = screen.queryByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(/\d/);
    });
  });
});
