// import * as path from 'path';
// import * as fs from 'fs-extra';
// import * as sinon from 'sinon';
// import { ExtensionContext } from 'vscode';
// import { createMockExtensionContext } from '../index';
// import { Credentials } from '../../../authentication';
// import { MarkdownFile } from '../../../remote-queries/remote-queries-markdown-generation';
// import * as actionsApiClient from '../../../remote-queries/gh-api/gh-actions-api-client';
// import { exportResultsToGist } from '../../../remote-queries/export-results';
//
// const proxyquire;
//
// describe('export results', async function() {
//   describe('exportResultsToGist', async function() {
//     let sandbox: sinon.SinonSandbox;
//     let mockCredentials: Credentials;
//     let mockResponse: sinon.SinonStub<any, Promise<{ status: number }>>;
//     let mockCreateGist: sinon.SinonStub;
//     let ctx: ExtensionContext;
//
//     beforeEach(() => {
//       sandbox = sinon.createSandbox();
//
//       mockCredentials = {
//         getOctokit: () => Promise.resolve({
//           request: mockResponse
//         })
//       } as unknown as Credentials;
//       sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);
//
//       const resultFiles = [] as MarkdownFile[];
//       proxyquire('../../../remote-queries/remote-queries-markdown-generation', {
//         'generateMarkdown': sinon.stub().returns(resultFiles)
//       });
//     });
//
//     afterEach(() => {
//       sandbox.restore();
//     });
//
//     it('should call the GitHub Actions API with the correct gist title', async function() {
//       mockCreateGist = sinon.stub(actionsApiClient, 'createGist');
//
//       ctx = createMockExtensionContext();
//       const query = JSON.parse(await fs.readFile(path.join(__dirname, '../data/remote-queries/query-with-results/query.json'), 'utf8'));
//       const analysesResults = JSON.parse(await fs.readFile(path.join(__dirname, '../data/remote-queries/query-with-results/analyses-results.json'), 'utf8'));
//
//       await exportResultsToGist(ctx, query, analysesResults);
//
//       expect(mockCreateGist.calledOnce).toBe(true);
//       expect(mockCreateGist.firstCall.args[1]).toBe(
//         'Shell command built from environment values (javascript) 3 results (10 repositories)'
//       );
//     });
//   });
// });
