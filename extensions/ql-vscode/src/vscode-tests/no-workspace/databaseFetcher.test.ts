import 'vscode-test';
import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';
import * as chai from 'chai';
import { window } from 'vscode';

import {
  convertLgtmUrlToDatabaseUrl,
  looksLikeLgtmUrl,
  findDirWithFile,
} from '../../databaseFetcher';
import { ProgressCallback } from '../../commandRunner';
import * as pq from 'proxyquire';

const proxyquire = pq.noPreserveCache();
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('databaseFetcher', function() {
  // These tests make API calls and may need extra time to complete.
  this.timeout(10000);

  describe('convertGithubNwoToDatabaseUrl', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickSpy: sinon.SinonStub;
    let progressSpy: ProgressCallback;
    let mockRequest: sinon.SinonStub;
    let mod: any;

    const credentials = getMockCredentials(0);

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      quickPickSpy = sandbox.stub(window, 'showQuickPick');
      progressSpy = sandbox.spy();
      mockRequest = sandbox.stub();
      mod = proxyquire('../../databaseFetcher', {
        './authentication': {
          Credentials: credentials,
        },
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should convert a GitHub nwo to a database url', async () => {
      // We can't make the real octokit request (since we need credentials), so we mock the response.
      const mockApiResponse = {
        data: [
          {
            id: 1495869,
            name: 'csharp-database',
            language: 'csharp',
            uploader: {},
            content_type: 'application/zip',
            state: 'uploaded',
            size: 55599715,
            created_at: '2022-03-24T10:46:24Z',
            updated_at: '2022-03-24T10:46:27Z',
            url: 'https://api.github.com/repositories/143040428/code-scanning/codeql/databases/csharp',
          },
          {
            id: 1100671,
            name: 'database.zip',
            language: 'javascript',
            uploader: {},
            content_type: 'application/zip',
            state: 'uploaded',
            size: 29294434,
            created_at: '2022-03-01T16:00:04Z',
            updated_at: '2022-03-01T16:00:06Z',
            url: 'https://api.github.com/repositories/143040428/code-scanning/codeql/databases/javascript',
          },
          {
            id: 648738,
            name: 'ql-database',
            language: 'ql',
            uploader: {},
            content_type: 'application/json; charset=utf-8',
            state: 'uploaded',
            size: 39735500,
            created_at: '2022-02-02T09:38:50Z',
            updated_at: '2022-02-02T09:38:51Z',
            url: 'https://api.github.com/repositories/143040428/code-scanning/codeql/databases/ql',
          },
        ],
      };
      mockRequest.resolves(mockApiResponse);
      quickPickSpy.resolves('javascript');
      const githubRepo = 'github/codeql';
      const dbUrl = await mod.convertGithubNwoToDatabaseUrl(
        githubRepo,
        credentials,
        progressSpy
      );

      expect(dbUrl).to.equal(
        'https://api.github.com/repos/github/codeql/code-scanning/codeql/databases/javascript'
      );
      expect(quickPickSpy.firstCall.args[0]).to.deep.equal([
        'csharp',
        'javascript',
        'ql',
      ]);
    });

    // Repository doesn't exist, or the user has no access to the repository.
    it('should fail on an invalid/inaccessible repository', async () => {
      const mockApiResponse = {
        data: {
          message: 'Not Found',
        },
        status: 404,
      };
      mockRequest.resolves(mockApiResponse);
      const githubRepo = 'foo/bar-not-real';
      await expect(
        mod.convertGithubNwoToDatabaseUrl(githubRepo, credentials, progressSpy)
      ).to.be.rejectedWith(/Unable to get database/);
      expect(progressSpy).to.have.callCount(0);
    });

    // User has access to the repository, but there are no databases for any language.
    it('should fail on a repository with no databases', async () => {
      const mockApiResponse = {
        data: [],
      };

      mockRequest.resolves(mockApiResponse);
      const githubRepo = 'foo/bar-with-no-dbs';
      await expect(
        mod.convertGithubNwoToDatabaseUrl(githubRepo, credentials, progressSpy)
      ).to.be.rejectedWith(/Unable to get database/);
      expect(progressSpy).to.have.been.calledOnce;
    });

    function getMockCredentials(response: any) {
      mockRequest = sinon.stub().resolves(response);
      return {
        getOctokit: () => ({
          request: mockRequest,
        }),
      };
    }
  });

  describe('convertLgtmUrlToDatabaseUrl', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickSpy: sinon.SinonStub;
    let progressSpy: ProgressCallback;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      quickPickSpy = sandbox.stub(window, 'showQuickPick');
      progressSpy = sandbox.spy();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should convert a project url to a database url', async () => {
      quickPickSpy.resolves('javascript');
      const lgtmUrl = 'https://lgtm.com/projects/g/github/codeql';
      const dbUrl = await convertLgtmUrlToDatabaseUrl(lgtmUrl, progressSpy);

      expect(dbUrl).to.equal(
        'https://lgtm.com/api/v1.0/snapshots/1506465042581/javascript'
      );
      expect(quickPickSpy.firstCall.args[0]).to.contain('javascript');
      expect(quickPickSpy.firstCall.args[0]).to.contain('python');
    });

    it('should convert a project url to a database url with extra path segments', async () => {
      quickPickSpy.resolves('python');
      const lgtmUrl =
        'https://lgtm.com/projects/g/github/codeql/subpage/subpage2?query=xxx';
      const dbUrl = await convertLgtmUrlToDatabaseUrl(lgtmUrl, progressSpy);

      expect(dbUrl).to.equal(
        'https://lgtm.com/api/v1.0/snapshots/1506465042581/python'
      );
      expect(progressSpy).to.have.been.calledOnce;
    });

    it('should convert a raw slug to a database url with extra path segments', async () => {
      quickPickSpy.resolves('python');
      const lgtmUrl =
        'g/github/codeql';
      const dbUrl = await convertLgtmUrlToDatabaseUrl(lgtmUrl, progressSpy);

      expect(dbUrl).to.equal(
        'https://lgtm.com/api/v1.0/snapshots/1506465042581/python'
      );
      expect(progressSpy).to.have.been.calledOnce;
    });

    it('should fail on a nonexistent project', async () => {
      quickPickSpy.resolves('javascript');
      const lgtmUrl = 'https://lgtm.com/projects/g/github/hucairz';
      await expect(convertLgtmUrlToDatabaseUrl(lgtmUrl, progressSpy)).to.rejectedWith(/Invalid LGTM URL/);
      expect(progressSpy).to.have.callCount(0);
    });
  });

  describe('looksLikeLgtmUrl', () => {
    it('should handle invalid urls', () => {
      expect(looksLikeLgtmUrl('')).to.be.false;
      expect(looksLikeLgtmUrl('http://lgtm.com/projects/g/github/codeql')).to.be
        .false;
      expect(looksLikeLgtmUrl('https://ww.lgtm.com/projects/g/github/codeql'))
        .to.be.false;
      expect(looksLikeLgtmUrl('https://ww.lgtm.com/projects/g/github')).to.be
        .false;
      expect(looksLikeLgtmUrl('g/github')).to.be
        .false;
      expect(looksLikeLgtmUrl('ggg/github/myproj')).to.be
        .false;
    });

    it('should handle valid urls', () => {
      expect(looksLikeLgtmUrl('https://lgtm.com/projects/g/github/codeql')).to
        .be.true;
      expect(looksLikeLgtmUrl('https://www.lgtm.com/projects/g/github/codeql'))
        .to.be.true;
      expect(
        looksLikeLgtmUrl('https://lgtm.com/projects/g/github/codeql/sub/pages')
      ).to.be.true;
      expect(
        looksLikeLgtmUrl(
          'https://lgtm.com/projects/g/github/codeql/sub/pages?query=string'
        )
      ).to.be.true;
      expect(looksLikeLgtmUrl('g/github/myproj')).to.be
        .true;
      expect(looksLikeLgtmUrl('git/github/myproj')).to.be
        .true;
    });
  });

  describe('findDirWithFile', () => {
    let dir: tmp.DirResult;
    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
      createFile('a');
      createFile('b');
      createFile('c');

      createDir('dir1');
      createFile('dir1', 'd');
      createFile('dir1', 'e');
      createFile('dir1', 'f');

      createDir('dir2');
      createFile('dir2', 'g');
      createFile('dir2', 'h');
      createFile('dir2', 'i');

      createDir('dir2', 'dir3');
      createFile('dir2', 'dir3', 'j');
      createFile('dir2', 'dir3', 'k');
      createFile('dir2', 'dir3', 'l');
    });

    it('should find files', async () => {
      expect(await findDirWithFile(dir.name, 'k')).to.equal(
        path.join(dir.name, 'dir2', 'dir3')
      );
      expect(await findDirWithFile(dir.name, 'h')).to.equal(
        path.join(dir.name, 'dir2')
      );
      expect(await findDirWithFile(dir.name, 'z', 'a')).to.equal(dir.name);
      // there's some slight indeterminism when more than one name exists
      // but in general, this will find files in the current directory before
      // finding files in sub-dirs
      expect(await findDirWithFile(dir.name, 'k', 'a')).to.equal(dir.name);
    });


    it('should not find files', async () => {
      expect(await findDirWithFile(dir.name, 'x', 'y', 'z')).to.be.undefined;
    });


    function createFile(...segments: string[]) {
      fs.createFileSync(path.join(dir.name, ...segments));
    }

    function createDir(...segments: string[]) {
      fs.mkdirSync(path.join(dir.name, ...segments));
    }
  });
});
