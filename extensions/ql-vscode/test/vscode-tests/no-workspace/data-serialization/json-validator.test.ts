import { JsonSchemaTypes } from "../../../../src/data-serialization/json-schema-types";
import { JsonValidator } from "../../../../src/data-serialization/json-validator";
import {
  QueryStatus,
  RemoteQueryHistoryItem,
} from "../../../../src/data-serialization/source-schemas-types/remote-query-history-item";

describe("JsonValidator", () => {
  let jsonValidator: JsonValidator;

  beforeAll(() => {
    jsonValidator = new JsonValidator();
  });

  for (const typeName of JsonSchemaTypes) {
    test(`throws error for invalid ${typeName} schema`, () => {
      const invalidJson = {
        invalidField: true,
      };

      const obj = JSON.parse(JSON.stringify(invalidJson));

      expect(() => {
        jsonValidator.validate(obj, typeName);
      }).toThrow(`Object does not match the "${typeName}" schema:`);
    });
  }

  it("should successfully validate RemoteQueryHistoryItem", () => {
    const items: RemoteQueryHistoryItem[] = [
      {
        t: "remote",
        status: QueryStatus.InProgress,
        completed: false,
        queryId: "123",
        remoteQuery: {
          queryName: "query-name1",
          queryFilePath: "query-file-path1",
          queryText: "query-text1",
          language: "Ruby",
          controllerRepository: {
            owner: "Matsumoto",
            name: "ruby/ruby",
          },
          executionStartTime: 123,
          actionsWorkflowRunId: 345,
          repositoryCount: 6,
        },
        userSpecifiedLabel: "a label",
      },
      {
        t: "remote",
        failureReason: "depression",
        resultCount: 2,
        status: QueryStatus.Completed,
        completed: true,
        queryId: "345",
        remoteQuery: {
          queryName: "query-name2",
          queryFilePath: "query-file-path2",
          queryText: "query-text2",
          language: "Ruby",
          controllerRepository: {
            owner: "Shopify",
            name: "shopify/yjit",
          },
          executionStartTime: 678,
          actionsWorkflowRunId: 901,
          repositoryCount: 3,
        },
        userSpecifiedLabel: "a label",
      },
    ];

    expect(jsonValidator.validate(items[0], "RemoteQueryHistoryItem")).toBe(
      items[0],
    );

    expect(jsonValidator.validate(items[1], "RemoteQueryHistoryItem")).toBe(
      items[1],
    );
  });
});
