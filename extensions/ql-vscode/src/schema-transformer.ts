import { RemoteQueryHistoryItem } from "./remote-queries/remote-query-history-item";
import { RemoteQueryHistoryItemSchema } from "./proto-generated/remote-query-history-item-schema_pb";
import { RemoteQuerySchema } from "./proto-generated/remote-query-schema_pb";
import { RemoteQuery } from "./remote-queries/remote-query";
import { RemoteRepositorySchema } from "./proto-generated/remote-repository-schema_pb";
import { Repository as RemoteRepository } from "./remote-queries/repository";
import { protoInt64 } from "@bufbuild/protobuf";
import { QueryStatus } from "./query-status";

export class SchemaTransformer {
  public static toSchemaRemoteQueryHistoryItem(
    item: RemoteQueryHistoryItem,
  ): RemoteQueryHistoryItemSchema {
    return new RemoteQueryHistoryItemSchema({
      t: item.t,
      failureReason: item.failureReason,
      resultCount: item.resultCount,
      status: item.status,
      completed: item.completed,
      queryId: item.queryId,
      remoteQuery: this.toSchemaRemoteQuery(item.remoteQuery),
      userSpecifiedLabel: item.userSpecifiedLabel,
    });
  }

  public static fromSchemaRemoteQueryHistoryItem(
    item: RemoteQueryHistoryItemSchema,
  ): RemoteQueryHistoryItem {
    return {
      t: "remote",
      failureReason: item?.failureReason,
      resultCount: item?.resultCount,
      status: item.status as QueryStatus,
      completed: item.completed,
      queryId: item.queryId,
      remoteQuery: this.fromSchemaRemoteQuery(
        item.remoteQuery as RemoteQuerySchema,
      ),
      userSpecifiedLabel: item?.userSpecifiedLabel,
    };
  }

  public static toSchemaRemoteQuery(item: RemoteQuery): RemoteQuerySchema {
    return new RemoteQuerySchema({
      queryName: item.queryName,
      queryFilePath: item.queryFilePath,
      queryText: item.queryText.toString(),
      language: item.language,
      controllerRepository: item.controllerRepository,
      executionStartTime: protoInt64.parse(item.executionStartTime),
      actionsWorkflowRunId: protoInt64.parse(item.actionsWorkflowRunId),
      repositoryCount: item.repositoryCount,
    });
  }

  public static fromSchemaRemoteQuery(item: RemoteQuerySchema): RemoteQuery {
    return {
      queryName: item.queryName,
      queryFilePath: item.queryFilePath,
      queryText: item.queryText,
      language: item.language,
      controllerRepository: this.fromSchemaRemoteRepository(
        item.controllerRepository as RemoteRepositorySchema,
      ),
      executionStartTime: Number(item.executionStartTime),
      actionsWorkflowRunId: Number(item.actionsWorkflowRunId),
      repositoryCount: item.repositoryCount,
    };
  }

  public static fromSchemaRemoteRepository(
    item: RemoteRepositorySchema,
  ): RemoteRepository {
    return {
      owner: item.owner,
      name: item.name,
    };
  }
}
