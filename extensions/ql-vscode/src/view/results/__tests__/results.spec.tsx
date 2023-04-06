import * as React from "react";
import { act, render as reactRender, screen } from "@testing-library/react";
import { ResultsApp } from "../results";
import {
  Interpretation,
  IntoResultsViewMsg,
  SortDirection,
} from "../../../pure/interface-types";
import * as fs from "fs-extra";
import { resolve } from "path";
import { ColumnKindCode } from "../../../pure/bqrs-cli-types";

const exampleSarif = fs.readJSONSync(
  resolve(
    __dirname,
    "../../../../test/vscode-tests/no-workspace/data/sarif/validSarif.sarif",
  ),
);

describe(ResultsApp.name, () => {
  const render = () => reactRender(<ResultsApp />);
  const postMessage = async (msg: IntoResultsViewMsg) => {
    await act(async () => {
      // window.postMessage doesn't set the origin correctly, see
      // https://github.com/jsdom/jsdom/issues/2745
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: msg,
        }),
      );

      // The event is dispatched asynchronously, so we need to wait for it to be handled.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

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

    await postMessage(message);

    expect(
      screen.getByText("'x' is assigned a value but never used."),
    ).toBeInTheDocument();

    await postMessage({
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

    await postMessage({
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

    await postMessage({
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
