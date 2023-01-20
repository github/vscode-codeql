import { VariantAnalysisHistoryItem } from "../../../src/remote-queries/variant-analysis-history-item";
import { SchemaTransformer } from "../../../src/schema-transformer";
import { createMockVariantAnalysisHistoryItem } from "../../factories/remote-queries/variant-analysis-history-item";
import { VariantAnalysisHistoryItemSchema } from "../../../src/proto-generated/variant-analysis-history-item-schema_pb";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisQueryLanguage,
  VariantAnalysisStatus,
} from "../../../src/remote-queries/shared/variant-analysis";
import { QueryStatus } from "../../../src/query-status";
import { protoInt64 } from "@bufbuild/protobuf";

describe("Schema Transformer", () => {
  let variantAnalysis: VariantAnalysisHistoryItem;

  it("should transform to schema", () => {
    variantAnalysis = createMockVariantAnalysisHistoryItem({});

    const schema = SchemaTransformer.toSchema(variantAnalysis);
    expect(schema.t).toEqual("variant-analysis");
  });

  it("should transform from schema", () => {
    const schema = new VariantAnalysisHistoryItemSchema({
      t: "variant-analysis",
      failureReason: VariantAnalysisFailureReason.NoReposQueried,
      resultCount: protoInt64.parse(2),
      status: QueryStatus.Completed,
      completed: true,
      variantAnalysis: {
        id: protoInt64.parse(2),
        controllerRepo: {
          id: protoInt64.parse(3),
          fullName: "test",
          private: false,
        },
        query: {
          name: "test",
          filePath: "test.js",
          language: VariantAnalysisQueryLanguage.Javascript,
          text: "pickles",
        },
        databases: {
          repositories: ["1", "2", "3"],
        },
        createdAt: "5",
        updatedAt: "6",
        executionStartTime: BigInt(7),
        status: VariantAnalysisStatus.Succeeded,
        completedAt: "8",
        actionsWorkflowRunId: protoInt64.parse(9),
        failureReason: VariantAnalysisFailureReason.NoReposQueried,
      },
      userSpecifiedLabel: "query-name",
    });

    const variantAnalysisHistoryItem = SchemaTransformer.fromSchema(schema);

    expect(variantAnalysisHistoryItem).toEqual({
      completed: true,
      failureReason: "noReposQueried",
      resultCount: 2,
      status: "Completed",
      t: "variant-analysis",
      userSpecifiedLabel: "query-name",
      variantAnalysis: {
        actionsWorkflowRunId: 9,
        completedAt: "8",
        controllerRepo: {
          fullName: "test",
          id: 3,
          private: false,
        },
        createdAt: "5",
        databases: {
          repositories: ["1", "2", "3"],
        },
        executionStartTime: 7,
        failureReason: "noReposQueried",
        id: 2,
        query: {
          filePath: "test.js",
          language: "javascript",
          name: "test",
          text: "pickles",
        },
        scannedRepos: [],
        status: "succeeded",
        updatedAt: "6",
      },
    });
  });
});
