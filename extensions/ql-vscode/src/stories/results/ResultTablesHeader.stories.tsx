import type { Meta, StoryFn } from "@storybook/react";

import { ResultTablesHeader as ResultTablesHeaderComponent } from "../../view/results/ResultTablesHeader";

import "../../view/results/resultsView.css";

export default {
  title: "Results/Result Tables Header",
  component: ResultTablesHeaderComponent,
} as Meta<typeof ResultTablesHeaderComponent>;

const Template: StoryFn<typeof ResultTablesHeaderComponent> = (args) => (
  <ResultTablesHeaderComponent {...args} />
);

export const ResultTablesHeader = Template.bind({});
ResultTablesHeader.args = {
  queryName: "test query",
  queryPath: "/a/b/c/query.ql",
  selectedTable: "#select",
  parsedResultSets: {
    pageNumber: 1,
    pageSize: 10,
    numPages: 2,
    numInterpretedPages: 2,
    resultSetNames: ["#select", "alerts"],
    resultSet: {
      t: "InterpretedResultSet",
      name: "#select",
      interpretation: {
        sourceLocationPrefix: "/home/bulk-builder/bulk-builder",
        numTruncatedResults: 0,
        numTotalResults: 15,
        data: {
          t: "SarifInterpretationData",
          version: "2.1.0",
          runs: [],
        },
      },
    },
  },
};
