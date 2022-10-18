import { AnalysesResultsManager } from '../../../remote-queries/analyses-results-manager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { expect } from 'chai';

import { CancellationToken, ExtensionContext, Uri } from 'vscode';
import { tmpDir } from '../../../helpers';
import { Credentials } from '../../../authentication';
import { RemoteQueryResult } from '../../../remote-queries/shared/remote-query-result';
import { getErrorMessage } from '../../../pure/helpers-pure';

describe('AnalysisResultsManager', () => {
  const STORAGE_DIR = Uri.file(path.join(tmpDir.name, 'remote-queries')).fsPath;

  let sandbox: sinon.SinonSandbox;
  let rawQueryHistory: any;
  let remoteQueryResult0: RemoteQueryResult;
  let remoteQueryResult1: RemoteQueryResult;

  let mockCredentials: any;
  let mockOctokit: any;
  let mockLogger: any;
  let mockCliServer: any;
  let arm: AnalysesResultsManager;

  beforeEach(() => {
    mockOctokit = {
      request: sandbox.stub()
    };
    mockCredentials = {
      getOctokit: () => mockOctokit
    };
    mockLogger = {
      log: sandbox.spy()
    };
    mockCliServer = {
      bqrsInfo: sandbox.spy(),
      bqrsDecode: sandbox.spy()
    };
    sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);

    arm = new AnalysesResultsManager(
      {} as ExtensionContext,
      mockCliServer,
      path.join(STORAGE_DIR, 'queries'),
      mockLogger
    );

    rawQueryHistory = fs.readJSONSync(path.join(STORAGE_DIR, 'workspace-query-history.json')).queries;
    remoteQueryResult0 = fs.readJSONSync(path.join(STORAGE_DIR, 'queries', rawQueryHistory[0].queryId, 'query-result.json'));
    remoteQueryResult1 = fs.readJSONSync(path.join(STORAGE_DIR, 'queries', rawQueryHistory[1].queryId, 'query-result.json'));
  });

  it('should avoid re-downloading an analysis result', async () => {
    // because the analysis result is already in on disk, it should not be downloaded
    const publisher = sandbox.spy();
    const analysisSummary = remoteQueryResult0.analysisSummaries[0];
    await arm.downloadAnalysisResults(analysisSummary, publisher);

    // Should not have made the request since the analysis result is already on disk
    expect(mockOctokit.request).to.not.have.been.called;

    // result should have been published twice
    // first time, it is in progress
    expect(publisher.getCall(0).args[0][0]).to.include({
      nwo: 'github/vscode-codeql',
      status: 'InProgress',
      // interpretedResults: ... avoid checking the interpretedResults object since it is complex
    });

    // second time, it has the path to the sarif file.
    expect(publisher.getCall(1).args[0][0]).to.include({
      nwo: 'github/vscode-codeql',
      status: 'Completed',
      // interpretedResults: ... avoid checking the interpretedResults object since it is complex
    });
    expect(publisher).to.have.been.calledTwice;

    // result should be stored in the manager
    expect(arm.getAnalysesResults(rawQueryHistory[0].queryId)[0]).to.include({
      nwo: 'github/vscode-codeql',
      status: 'Completed',
      // interpretedResults: ... avoid checking the interpretedResults object since it is complex
    });
    publisher.resetHistory();

    // now, let's try to download it again. This time, since it's already in memory,
    // it should not even be re-published
    await arm.downloadAnalysisResults(analysisSummary, publisher);
    expect(publisher).to.not.have.been.called;
  });

  it('should download two artifacts at once', async () => {
    const publisher = sandbox.spy();
    const analysisSummaries = [remoteQueryResult0.analysisSummaries[0], remoteQueryResult0.analysisSummaries[1]];
    await arm.loadAnalysesResults(analysisSummaries, undefined, publisher);

    const trimmed = publisher.getCalls().map(call => call.args[0]).map(args => {
      args.forEach((analysisResult: any) => delete analysisResult.interpretedResults);
      return args;
    });

    // As before, but now both summaries should have been published
    expect(trimmed[0]).to.deep.eq([{
      nwo: 'github/vscode-codeql',
      status: 'InProgress',
      resultCount: 15,
      lastUpdated: 1653447088649,
      starCount: 1
    }]);

    expect(trimmed[1]).to.deep.eq([{
      nwo: 'github/vscode-codeql',
      status: 'InProgress',
      resultCount: 15,
      lastUpdated: 1653447088649,
      starCount: 1
    }, {
      nwo: 'other/hucairz',
      status: 'InProgress',
      resultCount: 15,
      lastUpdated: 1653447088649,
      starCount: 1
    }]);

    // there is a third call. It is non-deterministic if
    // github/vscode-codeql is completed first or other/hucairz is.
    // There is not much point in trying to test it if the other calls are correct.

    expect(trimmed[3]).to.deep.eq([{
      nwo: 'github/vscode-codeql',
      status: 'Completed',
      resultCount: 15,
      lastUpdated: 1653447088649,
      starCount: 1
    }, {
      nwo: 'other/hucairz',
      status: 'Completed',
      resultCount: 15,
      lastUpdated: 1653447088649,
      starCount: 1
    }]);

    expect(publisher).to.have.callCount(4);
  });

  it('should avoid publishing when the request is cancelled', async () => {
    const publisher = sandbox.spy();
    const analysisSummaries = [...remoteQueryResult0.analysisSummaries];

    try {
      await arm.loadAnalysesResults(analysisSummaries, {
        isCancellationRequested: true
      } as CancellationToken, publisher);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(getErrorMessage(e)).to.contain('cancelled');
    }

    expect(publisher).not.to.have.been.called;
  });

  it('should get the analysis results', async () => {
    const publisher = sandbox.spy();
    const analysisSummaries0 = [remoteQueryResult0.analysisSummaries[0], remoteQueryResult0.analysisSummaries[1]];
    const analysisSummaries1 = [...remoteQueryResult1.analysisSummaries];

    await arm.loadAnalysesResults(analysisSummaries0, undefined, publisher);
    await arm.loadAnalysesResults(analysisSummaries1, undefined, publisher);

    const result0 = arm.getAnalysesResults(rawQueryHistory[0].queryId);
    const result0Again = arm.getAnalysesResults(rawQueryHistory[0].queryId);

    // Shoule be equal, but not equivalent
    expect(result0).to.deep.eq(result0Again);
    expect(result0).not.to.eq(result0Again);

    const result1 = arm.getAnalysesResults(rawQueryHistory[1].queryId);
    const result1Again = arm.getAnalysesResults(rawQueryHistory[1].queryId);
    expect(result1).to.deep.eq(result1Again);
    expect(result1).not.to.eq(result1Again);
  });

  // This test is failing on windows in CI.
  it.skip('should read sarif', async () => {
    const publisher = sandbox.spy();
    const analysisSummaries0 = [remoteQueryResult0.analysisSummaries[0]];
    await arm.loadAnalysesResults(analysisSummaries0, undefined, publisher);

    const sarif = fs.readJSONSync(path.join(STORAGE_DIR, 'queries', rawQueryHistory[0].queryId, '171543249', 'results.sarif'));
    const queryResults = sarif.runs
      .flatMap((run: any) => run.results)
      .map((result: any) => ({ message: result.message.text }));

    expect(publisher.getCall(1).args[0][0].results).to.deep.eq(queryResults);
  });

  it('should check if an artifact is downloaded and not in memory', async () => {
    // Load remoteQueryResult0.analysisSummaries[1] into memory
    await arm.downloadAnalysisResults(remoteQueryResult0.analysisSummaries[1], () => Promise.resolve());

    // on disk
    expect(await (arm as any).isAnalysisDownloaded(remoteQueryResult0.analysisSummaries[0])).to.be.true;

    // in memory
    expect(await (arm as any).isAnalysisDownloaded(remoteQueryResult0.analysisSummaries[1])).to.be.true;

    // not downloaded
    expect(await (arm as any).isAnalysisDownloaded(remoteQueryResult0.analysisSummaries[2])).to.be.false;
  });

  it('should load downloaded artifacts', async () => {
    await arm.loadDownloadedAnalyses(remoteQueryResult0.analysisSummaries);
    const queryId = rawQueryHistory[0].queryId;
    const analysesResultsNwos = arm.getAnalysesResults(queryId).map(ar => ar.nwo).sort();
    expect(analysesResultsNwos[0]).to.eq('github/vscode-codeql');
    expect(analysesResultsNwos[1]).to.eq('other/hucairz');
    expect(analysesResultsNwos.length).to.eq(2);
  });
});
