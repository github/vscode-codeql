import type { DecodedBqrs } from "../../../../../src/common/bqrs-cli-types";
import { parseGenerateModelResults } from "../../../../../src/model-editor/languages/ruby/generate";
import { ruby } from "../../../../../src/model-editor/languages/ruby";
import { createMockLogger } from "../../../../__mocks__/loggerMock";
import type { ModeledMethod } from "../../../../../src/model-editor/modeled-method";
import { EndpointType } from "../../../../../src/model-editor/method";

describe("parseGenerateModelResults", () => {
  it("should return the results", async () => {
    const bqrs: DecodedBqrs = {
      sourceModel: {
        columns: [
          { name: "type", kind: "String" },
          { name: "path", kind: "String" },
          { name: "kind", kind: "String" },
        ],
        tuples: [],
      },
      sinkModel: {
        columns: [
          { name: "type", kind: "String" },
          { name: "path", kind: "String" },
          { name: "kind", kind: "String" },
        ],
        tuples: [],
      },
      typeVariableModel: {
        columns: [
          { name: "name", kind: "String" },
          { name: "path", kind: "String" },
        ],
        tuples: [],
      },
      typeModel: {
        columns: [
          { name: "type1", kind: "String" },
          { name: "type2", kind: "String" },
          { name: "path", kind: "String" },
        ],
        tuples: [
          ["Array", "SQLite3::ResultSet", "Method[types].ReturnValue"],
          ["Array", "SQLite3::ResultSet", "Method[columns].ReturnValue"],
          ["Array", "SQLite3::Statement", "Method[types].ReturnValue"],
          ["Array", "SQLite3::Statement", "Method[columns].ReturnValue"],
        ],
      },
      summaryModel: {
        columns: [
          { name: "type", kind: "String" },
          { name: "path", kind: "String" },
          { name: "input", kind: "String" },
          { name: "output", kind: "String" },
          { name: "kind", kind: "String" },
        ],
        tuples: [
          [
            "SQLite3::Database",
            "Method[create_function]",
            "Argument[self]",
            "ReturnValue",
            "value",
          ],
          [
            "SQLite3::Value!",
            "Method[new]",
            "Argument[1]",
            "ReturnValue",
            "value",
          ],
        ],
      },
    };

    const result = parseGenerateModelResults(
      "/a/b/c/query.ql",
      bqrs,
      ruby,
      createMockLogger(),
    );
    expect(result).toEqual([
      {
        endpointType: EndpointType.Method,
        methodName: "types",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::ResultSet#types",
        type: "type",
        typeName: "SQLite3::ResultSet",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "columns",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::ResultSet#columns",
        type: "type",
        typeName: "SQLite3::ResultSet",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "types",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::Statement#types",
        type: "type",
        typeName: "SQLite3::Statement",
      },
      {
        endpointType: EndpointType.Method,
        methodName: "columns",
        methodParameters: "",
        packageName: "",
        path: "ReturnValue",
        relatedTypeName: "Array",
        signature: "SQLite3::Statement#columns",
        type: "type",
        typeName: "SQLite3::Statement",
      },
      {
        endpointType: EndpointType.Method,
        input: "Argument[self]",
        kind: "value",
        methodName: "create_function",
        methodParameters: "",
        output: "ReturnValue",
        packageName: "",
        provenance: "manual",
        signature: "SQLite3::Database#create_function",
        type: "summary",
        typeName: "SQLite3::Database",
      },
      {
        endpointType: EndpointType.Constructor,
        input: "Argument[1]",
        kind: "value",
        methodName: "new",
        methodParameters: "",
        output: "ReturnValue",
        packageName: "",
        provenance: "manual",
        signature: "SQLite3::Value!#new",
        type: "summary",
        typeName: "SQLite3::Value!",
      },
    ] satisfies ModeledMethod[]);
  });
});
