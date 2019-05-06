import * as fs from 'fs';
import { ExtensionContext } from 'vscode';
import * as bqrs from './bqrs';
import { EvaluationInfo } from './queries';
import * as qsClient from './queryserver-client';

/**
 * interface.ts
 * ------------
 *
 * A temporary stub which will be replaced by the webview that shows results.
 */

export function showResults(ctx: ExtensionContext, info: EvaluationInfo, qs: qsClient.Server) {
  bqrs.parse(fs.createReadStream(info.query.resultsPath)).then(
    parsed => {
      console.log(parsed.results);
    }).catch((e: Error) => {
      qs.log("ERROR");
      qs.log(e.toString());
      qs.log(e.stack + '');
      throw e;
    });
}
