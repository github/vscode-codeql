import { expect } from 'chai';
import { parseVariantAnalysisQueryLanguage, VariantAnalysisQueryLanguage } from '../../src/remote-queries/shared/variant-analysis';

describe('parseVariantAnalysisQueryLanguage', () => {
  it('parses a valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('javascript')).to.equal(VariantAnalysisQueryLanguage.Javascript);
  });

  it('returns undefined for an valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('rubbish')).to.not.exist;
  });
});
