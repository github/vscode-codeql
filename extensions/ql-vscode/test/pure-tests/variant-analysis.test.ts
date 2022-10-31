import { expect } from 'chai';
import {
  getActionsWorkflowRunUrl,
  parseVariantAnalysisQueryLanguage,
  VariantAnalysisQueryLanguage
} from '../../src/remote-queries/shared/variant-analysis';
import { createMockVariantAnalysis } from '../../src/vscode-tests/factories/remote-queries/shared/variant-analysis';

describe('parseVariantAnalysisQueryLanguage', () => {
  it('parses a valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('javascript')).to.equal(VariantAnalysisQueryLanguage.Javascript);
  });

  it('returns undefined for an valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('rubbish')).to.not.exist;
  });
});

describe('getActionsWorkflowRunUrl', () => {
  it('should get the run url', () => {
    const variantAnalysis = createMockVariantAnalysis();

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(variantAnalysis);

    expect(actionsWorkflowRunUrl).to.equal(`https://github.com/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}`);
  });
});
