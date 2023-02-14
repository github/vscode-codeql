import * as React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import AnalysisAlertResult from "../../view/variant-analysis/AnalysisAlertResult";
import type { AnalysisAlert } from "../../remote-queries/shared/analysis-result";

export default {
  title: "Variant Analysis/Analysis Alert Result",
  component: AnalysisAlertResult,
} as ComponentMeta<typeof AnalysisAlertResult>;

const Template: ComponentStory<typeof AnalysisAlertResult> = (args) => (
  <AnalysisAlertResult {...args} />
);

export const Warning = Template.bind({});

const warningAlert: AnalysisAlert = {
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

Warning.args = {
  alert: warningAlert,
};
