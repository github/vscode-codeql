import { RemoteQuery } from './remote-query';
import { RemoteQueryResult } from './remote-query-result';
import { AnalysisResults } from './shared/analysis-result';

export const sampleRemoteQuery: RemoteQuery = {
  queryName: 'Inefficient regular expression',
  queryFilePath: '/Users/foo/dev/vscode-codeql-starter/ql/javascript/ql/src/Performance/ReDoS.ql',
  queryText: '/**\n * @name Inefficient regular expression\n * @description A regular expression that requires exponential time to match certain inputs\n *              can be a performance bottleneck, and may be vulnerable to denial-of-service\n *              attacks.\n * @kind problem\n * @problem.severity error\n * @security-severity 7.5\n * @precision high\n * @id js/redos\n * @tags security\n *       external/cwe/cwe-1333\n *       external/cwe/cwe-730\n *       external/cwe/cwe-400\n */\n\nimport javascript\nimport semmle.javascript.security.performance.ReDoSUtil\nimport semmle.javascript.security.performance.ExponentialBackTracking\n\nfrom RegExpTerm t, string pump, State s, string prefixMsg\nwhere hasReDoSResult(t, pump, s, prefixMsg)\nselect t,\n  "This part of the regular expression may cause exponential backtracking on strings " + prefixMsg +\n    "containing many repetitions of \'" + pump + "\'."\n',
  language: 'javascript',
  controllerRepository: {
    owner: 'big-corp',
    name: 'controller-repo'
  },
  repositories: [
    {
      owner: 'big-corp',
      name: 'repo1'
    },
    {
      owner: 'big-corp',
      name: 'repo2'
    },
    {
      owner: 'big-corp',
      name: 'repo3'
    },
    {
      owner: 'big-corp',
      name: 'repo4'
    },
    {
      owner: 'big-corp',
      name: 'repo5'
    }
  ],
  executionStartTime: new Date('2022-01-06T17:02:15.026Z').getTime(),
  actionsWorkflowRunId: 1662757118
};

export const sampleRemoteQueryResult: RemoteQueryResult = {
  queryId: 'query123',
  executionEndTime: new Date('2022-01-06T17:04:37.026Z').getTime(),
  analysisSummaries: [
    {
      nwo: 'big-corp/repo1',
      resultCount: 85,
      fileSizeInBytes: 14123,
      downloadLink: {
        id: '137697017',
        urlPath: '/repos/big-corp/controller-repo/actions/artifacts/137697017',
        innerFilePath: 'results.sarif',
        queryId: 'query.ql-123-xyz'
      }
    },
    {
      nwo: 'big-corp/repo2',
      resultCount: 20,
      fileSizeInBytes: 8698,
      downloadLink: {
        id: '137697018',
        urlPath: '/repos/big-corp/controller-repo/actions/artifacts/137697018',
        innerFilePath: 'results.sarif',
        queryId: 'query.ql-123-xyz'
      }
    },
    {
      nwo: 'big-corp/repo3',
      resultCount: 8,
      fileSizeInBytes: 4123,
      downloadLink: {
        id: '137697019',
        urlPath: '/repos/big-corp/controller-repo/actions/artifacts/137697019',
        innerFilePath: 'results.sarif',
        queryId: 'query.ql-123-xyz'
      }
    },
    {
      nwo: 'big-corp/repo4',
      resultCount: 3,
      fileSizeInBytes: 3313,
      downloadLink: {
        id: '137697020',
        urlPath: '/repos/big-corp/controller-repo/actions/artifacts/137697020',
        innerFilePath: 'results.sarif',
        queryId: 'query.ql-123-xyz'
      }
    }
  ],
  analysisFailures: [
    {
      nwo: 'big-corp/repo5',
      error: 'Error message'
    },
    {
      nwo: 'big-corp/repo6',
      error: 'Error message'
    },
  ]
};


const createAnalysisResults = (n: number) => Array(n).fill(
  {
    message: 'This shell command depends on an uncontrolled [absolute path](1).',
    shortDescription: 'Shell command built from environment values',
    severity: 'Error',
    filePath: 'npm-packages/meteor-installer/config.js',
    codeSnippet: {
      startLine: 253,
      endLine: 257,
      text: '  if (isWindows()) {\n    //set for the current session and beyond\n    child_process.execSync(`setx path "${meteorPath}/;%path%`);\n    return;\n  }\n',
    },
    highlightedRegion: {
      startLine: 255,
      startColumn: 28,
      endColumn: 62
    },
    codeFlows: [
      {
        threadFlows: [
          {
            filePath: 'npm-packages/meteor-installer/config.js',
            highlightedRegion: {
              startLine: 35,
              startColumn: 20,
              endColumn: 61
            },
            codeSnippet: {
              startLine: 33,
              endLine: 37,
              text: '\nconst meteorLocalFolder = \'.meteor\';\nconst meteorPath = path.resolve(rootPath, meteorLocalFolder);\n\nmodule.exports = {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/config.js',
            highlightedRegion: {
              startLine: 35,
              startColumn: 7,
              endColumn: 61
            },
            codeSnippet: {
              startLine: 33,
              endLine: 37,
              text: '\nconst meteorLocalFolder = \'.meteor\';\nconst meteorPath = path.resolve(rootPath, meteorLocalFolder);\n\nmodule.exports = {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/config.js',
            highlightedRegion: {
              startLine: 40,
              startColumn: 3,
              endColumn: 13
            },
            codeSnippet: {
              startLine: 38,
              endLine: 42,
              text: '  METEOR_LATEST_VERSION,\n  extractPath: rootPath,\n  meteorPath,\n  release: process.env.INSTALL_METEOR_VERSION || METEOR_LATEST_VERSION,\n  rootPath,\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install.js',
            highlightedRegion: {
              startLine: 12,
              startColumn: 3,
              endColumn: 13
            },
            codeSnippet: {
              startLine: 10,
              endLine: 14,
              text: 'const os = require(\'os\');\nconst {\n  meteorPath,\n  release,\n  startedPath,\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install.js',
            highlightedRegion: {
              startLine: 11,
              startColumn: 7,
              endLine: 22,
              endColumn: 27
            },
            codeSnippet: {
              startLine: 9,
              endLine: 24,
              text: 'const tmp = require(\'tmp\');\nconst os = require(\'os\');\nconst {\n  meteorPath,\n  release,\n  startedPath,\n  extractPath,\n  isWindows,\n  rootPath,\n  sudoUser,\n  isSudo,\n  isMac,\n  METEOR_LATEST_VERSION,\n} = require(\'./config.js\');\nconst { uninstall } = require(\'./uninstall\');\nconst {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install.js',
            highlightedRegion: {
              startLine: 255,
              startColumn: 42,
              endColumn: 52
            },
            codeSnippet: {
              startLine: 253,
              endLine: 257,
              text: '  if (isWindows()) {\n    //set for the current session and beyond\n    child_process.execSync(`setx path "${meteorPath}/;%path%`);\n    return;\n  }\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install.js',
            highlightedRegion: {
              startLine: 255,
              startColumn: 28,
              endColumn: 62
            },
            codeSnippet: {
              startLine: 253,
              endLine: 257,
              text: '  if (isWindows()) {\n    //set for the current session and beyond\n    child_process.execSync(`setx path "${meteorPath}/;%path%`);\n    return;\n  }\n'
            }
          }
        ]
      },
      {
        threadFlows: [
          {
            filePath: 'npm-packages/meteor-installer/config2.js',
            highlightedRegion: {
              startLine: 35,
              startColumn: 20,
              endColumn: 61
            },
            codeSnippet: {
              startLine: 33,
              endLine: 37,
              text: '\nconst meteorLocalFolder = \'.meteor\';\nconst meteorPath = path.resolve(rootPath, meteorLocalFolder);\n\nmodule.exports = {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/config2.js',
            highlightedRegion: {
              startLine: 35,
              startColumn: 7,
              endColumn: 61
            },
            codeSnippet: {
              startLine: 33,
              endLine: 37,
              text: '\nconst meteorLocalFolder = \'.meteor\';\nconst meteorPath = path.resolve(rootPath, meteorLocalFolder);\n\nmodule.exports = {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/config2.js',
            highlightedRegion: {
              startLine: 40,
              startColumn: 3,
              endColumn: 13
            },
            codeSnippet: {
              startLine: 38,
              endLine: 42,
              text: '  METEOR_LATEST_VERSION,\n  extractPath: rootPath,\n  meteorPath,\n  release: process.env.INSTALL_METEOR_VERSION || METEOR_LATEST_VERSION,\n  rootPath,\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install2.js',
            highlightedRegion: {
              startLine: 12,
              startColumn: 3,
              endColumn: 13
            },
            codeSnippet: {
              startLine: 10,
              endLine: 14,
              text: 'const os = require(\'os\');\nconst {\n  meteorPath,\n  release,\n  startedPath,\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install2.js',
            highlightedRegion: {
              startLine: 11,
              startColumn: 7,
              endLine: 22,
              endColumn: 27
            },
            codeSnippet: {
              startLine: 9,
              endLine: 24,
              text: 'const tmp = require(\'tmp\');\nconst os = require(\'os\');\nconst {\n  meteorPath,\n  release,\n  startedPath,\n  extractPath,\n  isWindows,\n  rootPath,\n  sudoUser,\n  isSudo,\n  isMac,\n  METEOR_LATEST_VERSION,\n} = require(\'./config.js\');\nconst { uninstall } = require(\'./uninstall\');\nconst {\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install2.js',
            highlightedRegion: {
              startLine: 255,
              startColumn: 42,
              endColumn: 52
            },
            codeSnippet: {
              startLine: 253,
              endLine: 257,
              text: '  if (isWindows()) {\n    //set for the current session and beyond\n    child_process.execSync(`setx path "${meteorPath}/;%path%`);\n    return;\n  }\n'
            }
          },
          {
            filePath: 'npm-packages/meteor-installer/install2.js',
            highlightedRegion: {
              startLine: 255,
              startColumn: 28,
              endColumn: 62
            },
            codeSnippet: {
              startLine: 253,
              endLine: 257,
              text: '  if (isWindows()) {\n    //set for the current session and beyond\n    child_process.execSync(`setx path "${meteorPath}/;%path%`);\n    return;\n  }\n'
            }
          }
        ]
      }
    ]

  }
);

export const sampleAnalysesResultsStage1: AnalysisResults[] = [
  {
    nwo: 'big-corp/repo1',
    status: 'InProgress',
    results: []
  },
  {
    nwo: 'big-corp/repo2',
    status: 'InProgress',
    results: []

  },
  {
    nwo: 'big-corp/repo3',
    status: 'InProgress',
    results: []
  },
  // No entries for repo4
];

export const sampleAnalysesResultsStage2: AnalysisResults[] = [
  {
    nwo: 'big-corp/repo1',
    status: 'Completed',
    results: createAnalysisResults(85)
  },
  {
    nwo: 'big-corp/repo2',
    status: 'Completed',
    results: createAnalysisResults(20)
  },
  {
    nwo: 'big-corp/repo3',
    status: 'InProgress',
    results: []
  },
  {
    nwo: 'big-corp/repo4',
    status: 'InProgress',
    results: []
  },
];

export const sampleAnalysesResultsStage3: AnalysisResults[] = [
  {
    nwo: 'big-corp/repo1',
    status: 'Completed',
    results: createAnalysisResults(85)
  },
  {
    nwo: 'big-corp/repo2',
    status: 'Completed',
    results: createAnalysisResults(20)
  },
  {
    nwo: 'big-corp/repo3',
    status: 'Completed',
    results: createAnalysisResults(8)
  },
  {
    nwo: 'big-corp/repo4',
    status: 'Completed',
    results: createAnalysisResults(3)
  },
];

export const sampleAnalysesResultsWithFailure: AnalysisResults[] = [
  {
    nwo: 'big-corp/repo1',
    status: 'Completed',
    results: createAnalysisResults(85)
  },
  {
    nwo: 'big-corp/repo2',
    status: 'Completed',
    results: createAnalysisResults(20)
  },
  {
    nwo: 'big-corp/repo3',
    status: 'Failed',
    results: []
  },
  {
    nwo: 'big-corp/repo4',
    status: 'Completed',
    results: createAnalysisResults(3)
  },
];
