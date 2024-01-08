import type { Meta, StoryFn } from "@storybook/react";

import { FileCodeSnippet } from "../../view/common";

export default {
  title: "File Code Snippet",
  component: FileCodeSnippet,
} as Meta<typeof FileCodeSnippet>;

const Template: StoryFn<typeof FileCodeSnippet> = (args) => (
  <FileCodeSnippet {...args} />
);

export const WithCodeSnippet = Template.bind({});
WithCodeSnippet.args = {
  fileLink: {
    fileLinkPrefix:
      "https://github.com/PowerShell/PowerShell/blob/450d884668ca477c6581ce597958f021fac30bff",
    filePath: "src/System.Management.Automation/help/UpdatableHelpSystem.cs",
  },
  codeSnippet: {
    startLine: 1261,
    endLine: 1261,
    text: "                        entry.ExtractToFile(extractPath);",
  },
  highlightedRegion: {
    startLine: 1261,
    startColumn: 45,
    endLine: 1261,
    endColumn: 56,
  },
  message: {
    tokens: [
      {
        t: "text",
        text: "access to local variable extractPath",
      },
    ],
  },
  severity: "Warning",
};

export const WithoutCodeSnippet = Template.bind({});
WithoutCodeSnippet.args = {
  ...WithCodeSnippet.args,
  codeSnippet: undefined,
};
