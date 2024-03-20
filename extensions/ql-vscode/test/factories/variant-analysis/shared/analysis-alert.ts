import type { AnalysisAlert } from "../../../../src/variant-analysis/shared/analysis-result";

export function createMockAnalysisAlert(): AnalysisAlert {
  return {
    message: {
      tokens: [
        {
          t: "text",
          text: "This is an empty block.",
        },
      ],
    },
    shortDescription: "This is an empty block.",
    fileLink: {
      fileLinkPrefix:
        "https://github.com/expressjs/express/blob/33e8dc303af9277f8a7e4f46abfdcb5e72f6797b",
      filePath: "test/app.options.js",
    },
    severity: "Warning",
    codeSnippet: {
      startLine: 10,
      endLine: 14,
      text: "    app.del('/', function(){});\n    app.get('/users', function(req, res){});\n    app.put('/users', function(req, res){});\n\n    request(app)\n",
    },
    highlightedRegion: {
      startLine: 12,
      startColumn: 41,
      endLine: 12,
      endColumn: 43,
    },
    codeFlows: [],
  };
}
