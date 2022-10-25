import { describe, it, expect } from '@jest/globals';
import { parseVariantAnalysisQueryLanguage, VariantAnalysisQueryLanguage } from '../../src/remote-queries/shared/variant-analysis';

describe('parseVariantAnalysisQueryLanguage', () => {
  it('parses a valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('javascript')).toBe(VariantAnalysisQueryLanguage.Javascript);
  });

  it('returns undefined for an valid language', () => {
    expect(parseVariantAnalysisQueryLanguage('rubbish')).toBeFalsy();
  });
});
