import { RemoteQueryHistoryItem } from "./remote-queries/remote-query-history-item";
import { RemoteQueryHistoryItemSchema } from "./proto-generated/remote-query-history-item-schema_pb";
import { RemoteQuerySchema } from "./proto-generated/remote-query-schema_pb";
import { RemoteQuery } from "./remote-queries/remote-query";
import { RemoteRepositorySchema } from "./proto-generated/remote-repository-schema_pb";
import { Repository as RemoteRepository } from "./remote-queries/repository";
import { protoInt64 } from "@bufbuild/protobuf";
import { QueryStatus } from "./query-status";
import {VariantAnalysisHistoryItem} from "./remote-queries/variant-analysis-history-item";
import {VariantAnalysisHistoryItemSchema} from "./proto-generated/variant-analysis-history-item-schema_pb";
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisQueryLanguage, VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepository,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisStatus
} from "./remote-queries/shared/variant-analysis";
import { VariantAnalysisSchema } from "./proto-generated/variant-analysis-schema_pb";
import { ScannedRepoSchema } from "./proto-generated/scanned-repo-schema_pb";
import { SkippedRepoSchema } from "./proto-generated/skipped-repo-schema_pb";
import { SkippedRepoGroupSchema } from "./proto-generated/skipped-repo-group-schema_pb";
import { VariantAnalysisSkippedRepoSchema } from "./proto-generated/variant-analysis-skipped-repo-schema_pb";
import { RepositorySchema } from "./proto-generated/repository-schema_pb";
import { Repository } from "./remote-queries/shared/repository";

export class SchemaTransformer {
  public static isOfType<T>(value: any, property: keyof T): value is T {
    return (value as T)[property] !== undefined;
  }

  public static toSchema(item: any) {
    if (this.isOfType<RemoteQueryHistoryItem>(item, "remoteQuery")) {
      this.toSchemaRemoteQueryHistoryItem(item);
    } else if (this.isOfType<VariantAnalysisHistoryItem>(item, "variantAnalysis")) {
      this.toSchemaVariantAnalysisHistoryItem(item);
    }
  }

  public static fromSchema(item: any) {
    if (this.isOfType<RemoteQueryHistoryItemSchema>(item, "remoteQuery")) {
      this.fromSchemaRemoteQueryHistoryItem(item);
    } else if (this.isOfType<VariantAnalysisHistoryItemSchema>(item, "variantAnalysis")) {
      this.fromSchemaVariantAnalysisHistoryItem(item);
    }
  }

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

  public static toSchemaVariantAnalysisHistoryItem(item: VariantAnalysisHistoryItem): VariantAnalysisHistoryItemSchema {
    return new VariantAnalysisHistoryItemSchema({
      t: 'variant-analysis',
      failureReason: item?.failureReason,
      resultCount: item.resultCount ? protoInt64.parse(item.resultCount) : undefined,
      status: item.status,
      completed: item.completed,
      variantAnalysis: this.toSchemaVariantAnalysisSchema(item.variantAnalysis),
      userSpecifiedLabel: item.userSpecifiedLabel
    });
  }

  public static toSchemaVariantAnalysisSchema(item: VariantAnalysis): VariantAnalysisSchema {
    return new VariantAnalysisSchema({
      id: protoInt64.parse(item.id),
      controllerRepo: {
        id: protoInt64.parse(item.controllerRepo.id),
        fullName: item.controllerRepo.fullName,
        private: item.controllerRepo.private,
      },
      query: item.query,
      databases: {
        repositories: item.databases.repositories,
        repositoryLists: item.databases.repositoryLists,
        repositoryOwners: item.databases.repositoryOwners,
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      executionStartTime: protoInt64.parse(item.executionStartTime),
      status: item.status,
      completedAt: item?.completedAt,
      actionsWorkflowRunId: item.actionsWorkflowRunId ? protoInt64.parse(item.actionsWorkflowRunId): undefined,
      failureReason: item?.failureReason,
      scannedRepos: item?.scannedRepos?.map(repo => this.toSchemaScannedRepo(repo)),
      skippedRepos: item.skippedRepos ? this.toSchemaSkippedRepos(item?.skippedRepos) : undefined,
    });
  }

  public static toSchemaSkippedRepos(item: VariantAnalysisSkippedRepositories): SkippedRepoSchema {
    return new SkippedRepoSchema({
      accessMismatchRepos: item.accessMismatchRepos ? this.toSchemaSkippedRepoGroup(item?.accessMismatchRepos) : undefined,
      notFoundRepos: item.notFoundRepos ? this.toSchemaSkippedRepoGroup(item?.notFoundRepos) : undefined,
      noCodeqlDbRepos: item.noCodeqlDbRepos ? this.toSchemaSkippedRepoGroup(item?.noCodeqlDbRepos) : undefined,
      overLimitRepos: item.overLimitRepos ? this.toSchemaSkippedRepoGroup(item?.overLimitRepos) : undefined,
    });
  }

  public static toSchemaScannedRepo(item: VariantAnalysisScannedRepository): ScannedRepoSchema {
    return new ScannedRepoSchema({
      repository: {
        id: protoInt64.parse(item.repository.id),
        fullName: item.repository.fullName,
        private: item.repository.private,
        stargazersCount: item.repository.stargazersCount,
        updatedAt: item.repository?.updatedAt || undefined,
      },
      analysisStatus: item.analysisStatus,
      resultCount: item.resultCount,
      artifactSizeInBytes: item.artifactSizeInBytes,
      failureMessage: item.failureMessage,
    })
  }

  public static toSchemaSkippedRepoGroup(item: VariantAnalysisSkippedRepositoryGroup): SkippedRepoGroupSchema {
    return new SkippedRepoGroupSchema({
      repositoryCount: item.repositoryCount,
      repositories: item.repositories.map(r => this.toSchemaSkippedRepo(r)),
    })
  }

  public static toSchemaSkippedRepo(item: VariantAnalysisSkippedRepository): VariantAnalysisSkippedRepoSchema {
    return new VariantAnalysisSkippedRepoSchema({
      id: item.id ? protoInt64.parse(item?.id) : undefined,
      fullName: item.fullName,
      private: item?.private,
      stargazersCount: item?.stargazersCount,
      updatedAt: item?.updatedAt || undefined,
    })
  }

  public static fromSchemaVariantAnalysisHistoryItem(item: VariantAnalysisHistoryItemSchema): VariantAnalysisHistoryItem {
    return {
      t: 'variant-analysis',
      failureReason: item?.failureReason,
      resultCount: item.resultCount ? Number(item.resultCount) : undefined,
      status: item.status as QueryStatus,
      completed: item.completed,
      variantAnalysis: this.fromSchemaVariantAnalysisSchema(item.variantAnalysis as VariantAnalysisSchema),
      userSpecifiedLabel: item.userSpecifiedLabel
    };
  }

  public static fromSchemaVariantAnalysisSchema(item: VariantAnalysisSchema): VariantAnalysis {
    return {
      id: Number(item.id),
      controllerRepo: this.fromSchemaRepository(item.controllerRepo as RepositorySchema),
      query: {
        name: item.query.name,
        filePath: item.query.filePath,
        language: item.query.language as VariantAnalysisQueryLanguage,
        text: item.query.text,
      },
      databases: {
        repositories: item.databases?.repositories,
        repositoryLists: item.databases?.repositoryLists,
        repositoryOwners: item.databases?.repositoryOwners,
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      executionStartTime: Number(item.executionStartTime),
      status: item.status as VariantAnalysisStatus,
      completedAt: item?.completedAt,
      actionsWorkflowRunId: item.actionsWorkflowRunId ? Number(item.actionsWorkflowRunId): undefined,
      failureReason: item?.failureReason as VariantAnalysisFailureReason,
      scannedRepos: item?.scannedRepos?.map(repo => this.fromSchemaScannedRepo(repo)),
      skippedRepos: item.skippedRepos ? this.fromSchemaSkippedRepos(item?.skippedRepos) : undefined,
    };
  }

  public static fromSchemaRepository(item: RepositorySchema): Repository {
    return {
      id: Number(item.id),
      fullName: item.fullName,
      private: item.private,
    };
  }

  public static fromSchemaSkippedRepos(item: SkippedRepoSchema): VariantAnalysisSkippedRepositories {
    return {
      accessMismatchRepos: item.accessMismatchRepos ? this.fromSchemaSkippedRepoGroup(item?.accessMismatchRepos) : undefined,
      notFoundRepos: item.notFoundRepos ? this.fromSchemaSkippedRepoGroup(item?.notFoundRepos) : undefined,
      noCodeqlDbRepos: item.noCodeqlDbRepos ? this.fromSchemaSkippedRepoGroup(item?.noCodeqlDbRepos) : undefined,
      overLimitRepos: item.overLimitRepos ? this.fromSchemaSkippedRepoGroup(item?.overLimitRepos) : undefined,
    };
  }

  public static fromSchemaScannedRepo(item: ScannedRepoSchema): VariantAnalysisScannedRepository {
    return {
      repository: {
        id: Number(item.repository?.id),
        fullName: item.repository?.fullName || '',
        private: Boolean(item.repository?.private),
        stargazersCount: Number(item.repository?.stargazersCount),
        updatedAt: item.repository?.updatedAt || null,
      },
      analysisStatus: item.analysisStatus as VariantAnalysisRepoStatus,
      resultCount: item.resultCount,
      artifactSizeInBytes: item.artifactSizeInBytes,
      failureMessage: item.failureMessage,
    }
  }

  public static fromSchemaSkippedRepoGroup(item: SkippedRepoGroupSchema): VariantAnalysisSkippedRepositoryGroup {
    return {
      repositoryCount: item.repositoryCount,
      repositories: item.repositories.map(r => this.fromSchemaSkippedRepo(r)),
    }
  }

  public static fromSchemaSkippedRepo(item: VariantAnalysisSkippedRepoSchema): VariantAnalysisSkippedRepository {
    return {
      id: item.id ? Number(item?.id) : undefined,
      fullName: item.fullName,
      private: item?.private,
      stargazersCount: item?.stargazersCount,
      updatedAt: item?.updatedAt || undefined,
    }
  }
}
