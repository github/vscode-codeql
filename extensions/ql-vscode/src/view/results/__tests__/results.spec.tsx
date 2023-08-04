import * as React from "react";
import { render as reactRender, screen } from "@testing-library/react";
import { ResultsApp } from "../results";
import {
  Interpretation,
  IntoResultsViewMsg,
  SortDirection,
} from "../../../common/interface-types";
import * as fs from "fs-extra";
import { resolve } from "path";
import { ColumnKindCode } from "../../../common/bqrs-cli-types";
import { postMessage } from "../../common/post-message";

const exampleSarif = fs.readJSONSync(
  resolve(__dirname, "../../../../test/data/sarif/validSarif.sarif"),
);

describe(ResultsApp.name, () => {
  const render = () => reactRender(<ResultsApp />);

  it("renders results", async () => {
    render();

    const interpretation: Interpretation = {
      sourceLocationPrefix: "/a/b/c",
      numTruncatedResults: 0,
      numTotalResults: 1,
      data: {
        t: "SarifInterpretationData",
        sortState: undefined,
        ...exampleSarif,
      },
    };
    const message: IntoResultsViewMsg = {
      t: "setState",
      resultsPath: "/a/b/c/results",
      origResultsPaths: {
        resultsPath: "/a/b/c/results.bqrs",
        interpretedResultsPath: "/a/b/c/interpreted-results.sarif",
      },
      sortedResultsMap: {
        "1": {
          resultsPath: "/a/b/c/results.bqrs",
          sortState: {
            columnIndex: 1,
            sortDirection: SortDirection.asc,
          },
        },
      },
      interpretation,
      database: {
        name: "test-db",
        databaseUri: "test-db-uri",
      },
      metadata: undefined, // TODO
      queryName: "test-query",
      queryPath: "/a/b/c/query.ql",
      shouldKeepOldResultsWhileRendering: false,
      parsedResultSets: {
        pageNumber: 1,
        pageSize: 1,
        numPages: 1,
        numInterpretedPages: 1,
        resultSetNames: ["#select"],
        resultSet: {
          t: "InterpretedResultSet",
          schema: {
            name: "#select",
            rows: 1,
            columns: [
              {
                name: "Path",
                kind: ColumnKindCode.STRING,
              },
            ],
          },
          name: "#select",
          interpretation,
        },
      },
    };

    await postMessage<IntoResultsViewMsg>(message);

    expect(
      screen.getByText("'x' is assigned a value but never used."),
    ).toBeInTheDocument();

    await postMessage<IntoResultsViewMsg>({
      ...message,
      t: "showInterpretedPage",
      pageNumber: 1,
      numPages: 1,
      pageSize: 1,
      resultSetNames: ["#select"],
      queryName: "test-query",
      queryPath: "/a/b/c/query.ql",
      interpretation,
    });

    expect(
      screen.getByText("'x' is assigned a value but never used."),
    ).toBeInTheDocument();
  });

  it("renders results when switching between queries with different result set names", async () => {
    render();

    await postMessage<IntoResultsViewMsg>({
      t: "setState",
      interpretation: undefined,
      origResultsPaths: {
        resultsPath: "/a/b/c/results.bqrs",
        interpretedResultsPath: "/a/b/c/interpretedResults.sarif",
      },
      resultsPath: "/a/b/c/results.bqrs",
      parsedResultSets: {
        pageNumber: 0,
        pageSize: 200,
        numPages: 1,
        numInterpretedPages: 0,
        resultSet: {
          schema: {
            name: "#select",
            rows: 1,
            columns: [{ kind: "s" }],
            pagination: { "step-size": 200, offsets: [13] },
          },
          rows: [["foobar1"]],
          t: "RawResultSet",
        },
        resultSetNames: ["#select"],
      },
      sortedResultsMap: {},
      database: {
        name: "test-db",
        databaseUri: "test-db-uri",
      },
      shouldKeepOldResultsWhileRendering: false,
      metadata: {},
      queryName: "empty.ql",
      queryPath: "/a/b/c/empty.ql",
    });

    expect(screen.getByText("foobar1")).toBeInTheDocument();

    await postMessage<IntoResultsViewMsg>({
      t: "setState",
      interpretation: undefined,
      origResultsPaths: {
        resultsPath: "/a/b/c/results.bqrs",
        interpretedResultsPath: "/a/b/c/interpretedResults.sarif",
      },
      resultsPath: "/a/b/c/results.bqrs",
      parsedResultSets: {
        pageNumber: 0,
        pageSize: 200,
        numPages: 1,
        numInterpretedPages: 0,
        resultSet: {
          schema: {
            name: "#Quick_evaluation_of_expression",
            rows: 1,
            columns: [{ name: "#expr_result", kind: "s" }],
            pagination: { "step-size": 200, offsets: [49] },
          },
          rows: [["foobar2"]],
          t: "RawResultSet",
        },
        resultSetNames: ["#Quick_evaluation_of_expression"],
      },
      sortedResultsMap: {},
      database: {
        name: "test-db",
        databaseUri: "test-db-uri",
      },
      shouldKeepOldResultsWhileRendering: false,
      metadata: {},
      queryName: "Quick evaluation of empty.ql:1",
      queryPath: "/a/b/c/empty.ql",
    });

    expect(screen.getByText("foobar2")).toBeInTheDocument();
  });
});
