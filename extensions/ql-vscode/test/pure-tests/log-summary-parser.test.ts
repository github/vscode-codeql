import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import 'mocha';

import { parseViewerData } from '../../src/pure/log-summary-parser';

describe('Evaluator log summary tests', async function() {
  describe('for a valid summary text', async function() {
    it('should return only valid EvalLogData objects', async function() {
      const validSummaryText = await fs.readFile(path.join(__dirname, 'evaluator-log-summaries/valid-summary.jsonl'), 'utf8');
      const logDataItems = parseViewerData(validSummaryText.toString());
      expect(logDataItems).to.not.be.undefined;
      expect(logDataItems.length).to.eq(3);
      for (const item of logDataItems) {
        expect(item.predicateName).to.not.be.empty;
        expect(item.millis).to.be.a('number');
        expect(item.resultSize).to.be.a('number');
        expect(item.ra).to.not.be.undefined;
        expect(item.ra).to.not.be.empty;
        for (const [pipeline, steps] of Object.entries(item.ra)) {
          expect(pipeline).to.not.be.empty;
          expect(steps).to.not.be.undefined;
          expect(steps.length).to.be.greaterThan(0);
        }
      }
    });

    it('should not parse a summary header object', async function() {
      const invalidHeaderText = await fs.readFile(path.join(__dirname, 'evaluator-log-summaries/invalid-header.jsonl'), 'utf8');
      const logDataItems = parseViewerData(invalidHeaderText);
      expect(logDataItems.length).to.eq(0);
    });

    it('should not parse a log event missing RA or millis fields', async function() {
      const invalidSummaryText = await fs.readFile(path.join(__dirname, 'evaluator-log-summaries/invalid-summary.jsonl'), 'utf8');
      const logDataItems = parseViewerData(invalidSummaryText);
      expect(logDataItems.length).to.eq(0);
    });
  });
});
