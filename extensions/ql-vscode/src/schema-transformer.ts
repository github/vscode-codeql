import { RemoteQueryHistoryItem } from "./remote-queries/remote-query-history-item";
import { RemoteQueryHistoryItemSchema } from "./proto-generated/remote-query-history-item-schema_pb";
import { RemoteQuerySchema } from "./proto-generated/remote-query-schema_pb";
import { RemoteQuery } from "./remote-queries/remote-query";
import { RemoteRepositorySchema } from "./proto-generated/remote-repository-schema_pb";
import { Repository as RemoteRepository } from "./remote-queries/repository";
import { protoInt64 } from "@bufbuild/protobuf";
import { QueryStatus } from "./query-status";
import { VariantAnalysisHistoryItem } from "./remote-queries/variant-analysis-history-item";
import { VariantAnalysisHistoryItemSchema } from "./proto-generated/variant-analysis-history-item-schema_pb";
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepository,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisStatus,
} from "./remote-queries/shared/variant-analysis";
import { VariantAnalysisSchema } from "./proto-generated/variant-analysis-schema_pb";
import { ScannedRepoSchema } from "./proto-generated/scanned-repo-schema_pb";
import { SkippedRepoSchema } from "./proto-generated/skipped-repo-schema_pb";
import { SkippedRepoGroupSchema } from "./proto-generated/skipped-repo-group-schema_pb";
import { VariantAnalysisSkippedRepoSchema } from "./proto-generated/variant-analysis-skipped-repo-schema_pb";
import { RepositorySchema } from "./proto-generated/repository-schema_pb";
import {
  Repository,
  RepositoryWithMetadata,
} from "./remote-queries/shared/repository";
import { RepositoryWithMetadataSchema } from "./proto-generated/repository-with-metadata-schema_pb";
import { VariantAnalysisDatabasesSchema } from "./proto-generated/variant-analysis-databases-schema_pb";

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

  public static isA<T>(value: any, property: keyof T): value is T {
    return (value as T)[property] !== undefined;
  }

  public static toSchema(item: any) {
    if (this.isA<RemoteQueryHistoryItem>(item, "remoteQuery")) {
      return this.toSchemaRemoteQueryHistoryItem(item);
    }

    return this.toSchemaVariantAnalysisHistoryItem(item);
  }

  public static fromSchema(item: any) {
    if (this.isA<RemoteQueryHistoryItemSchema>(item, "remoteQuery")) {
      return this.fromSchemaRemoteQueryHistoryItem(item);
    }

    return this.fromSchemaVariantAnalysisHistoryItem(item);
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

  public static toSchemaVariantAnalysisHistoryItem(
    item: VariantAnalysisHistoryItem,
  ): VariantAnalysisHistoryItemSchema {
    return new VariantAnalysisHistoryItemSchema({
      t: "variant-analysis",
      failureReason: item.failureReason,
      ...(item.resultCount && {
        resultCount: protoInt64.parse(item.resultCount),
      }),
      status: item.status,
      completed: item.completed,
      variantAnalysis: this.toSchemaVariantAnalysisSchema(item.variantAnalysis),
      userSpecifiedLabel: item.userSpecifiedLabel,
    });
  }

  public static toSchemaVariantAnalysisSchema(
    item: VariantAnalysis,
  ): VariantAnalysisSchema {
    return new VariantAnalysisSchema({
      id: protoInt64.parse(item.id),
      controllerRepo: {
        id: protoInt64.parse(item.controllerRepo.id),
        fullName: item.controllerRepo.fullName,
        private: item.controllerRepo.private,
      },
      query: item.query,
      databases: this.toSchemaVariantAnalysisDatabasesSchema(item.databases),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      executionStartTime: protoInt64.parse(item.executionStartTime),
      status: item.status,
      ...(item.completedAt && { completedAt: item.completedAt }),
      ...(item.actionsWorkflowRunId && {
        actionsWorkflowRunId: protoInt64.parse(item.actionsWorkflowRunId),
      }),
      ...(item.failureReason && { failureReason: item.failureReason }),
      ...(item.scannedRepos && {
        scannedRepos: item.scannedRepos.map((repo) =>
          this.toSchemaScannedRepo(repo),
        ),
      }),
      ...(item.skippedRepos && {
        skippedRepos: this.toSchemaSkippedRepos(item?.skippedRepos),
      }),
    });
  }

  public static toSchemaVariantAnalysisDatabasesSchema(
    item: any,
  ): VariantAnalysisDatabasesSchema {
    return new VariantAnalysisDatabasesSchema({
      repositories: item.repositories,
      repositoryLists: item.repositoryLists,
      repositoryOwners: item.repositoryOwners,
    });
  }

  public static toSchemaSkippedRepos(
    item: VariantAnalysisSkippedRepositories,
  ): SkippedRepoSchema {
    return new SkippedRepoSchema({
      ...(item.accessMismatchRepos && {
        accessMismatchRepos: this.toSchemaSkippedRepoGroup(
          item.accessMismatchRepos,
        ),
      }),
      ...(item.notFoundRepos && {
        notFoundRepos: this.toSchemaSkippedRepoGroup(item.notFoundRepos),
      }),
      ...(item.noCodeqlDbRepos && {
        noCodeqlDbRepos: this.toSchemaSkippedRepoGroup(item.noCodeqlDbRepos),
      }),
      ...(item.overLimitRepos && {
        overLimitRepos: this.toSchemaSkippedRepoGroup(item.overLimitRepos),
      }),
    });
  }

  public static toSchemaScannedRepo(
    item: VariantAnalysisScannedRepository,
  ): ScannedRepoSchema {
    return new ScannedRepoSchema({
      repository: {
        id: protoInt64.parse(item.repository.id),
        fullName: item.repository.fullName,
        private: item.repository.private,
        stargazersCount: item.repository.stargazersCount,
        ...(item.repository.updatedAt && {
          updatedAt: item.repository.updatedAt,
        }),
      },
      analysisStatus: item.analysisStatus,
      resultCount: item.resultCount,
      artifactSizeInBytes: item.artifactSizeInBytes,
      failureMessage: item.failureMessage,
    });
  }

  public static toSchemaSkippedRepoGroup(
    item: VariantAnalysisSkippedRepositoryGroup,
  ): SkippedRepoGroupSchema {
    return new SkippedRepoGroupSchema({
      repositoryCount: item.repositoryCount,
      repositories: item.repositories.map((r) => this.toSchemaSkippedRepo(r)),
    });
  }

  public static toSchemaSkippedRepo(
    item: VariantAnalysisSkippedRepository,
  ): VariantAnalysisSkippedRepoSchema {
    return new VariantAnalysisSkippedRepoSchema({
      ...(item.id && { id: protoInt64.parse(item.id) }),
      fullName: item.fullName,
      private: item?.private,
      stargazersCount: item?.stargazersCount,
      ...(item.updatedAt && { updatedAt: item.updatedAt }),
    });
  }

  public static fromSchemaVariantAnalysisHistoryItem(
    item: VariantAnalysisHistoryItemSchema,
  ): VariantAnalysisHistoryItem {
    return {
      t: "variant-analysis",
      failureReason: item.failureReason == "" ? undefined : item.failureReason,
      ...(item.resultCount && { resultCount: Number(item.resultCount) }),
      status: item.status as QueryStatus,
      completed: item.completed,
      variantAnalysis: this.fromSchemaVariantAnalysis(
        item.variantAnalysis as VariantAnalysisSchema,
      ),
      userSpecifiedLabel: item.userSpecifiedLabel,
    };
  }

  public static fromSchemaVariantAnalysis(
    item: VariantAnalysisSchema,
  ): VariantAnalysis {
    return {
      id: Number(item.id),
      controllerRepo: this.fromSchemaRepository(
        item.controllerRepo as RepositorySchema,
      ),
      query: {
        name: item.query.name,
        filePath: item.query.filePath,
        language: item.query.language as VariantAnalysisQueryLanguage,
        text: item.query.text,
      },
      databases: this.fromSchemaVariantAnalysisDatabases(
        item.databases as VariantAnalysisDatabasesSchema,
      ),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      executionStartTime: Number(item.executionStartTime),
      status: item.status as VariantAnalysisStatus,
      ...(item.completedAt && { completedAt: item.completedAt }),
      ...(item.actionsWorkflowRunId && {
        actionsWorkflowRunId: Number(item.actionsWorkflowRunId),
      }),
      ...(item.failureReason && {
        failureReason: item.failureReason as VariantAnalysisFailureReason,
      }),
      ...(item.scannedRepos && {
        scannedRepos: item.scannedRepos.map((repo) =>
          this.fromSchemaScannedRepo(repo),
        ),
      }),
      ...(item.skippedRepos && {
        skippedRepos: this.fromSchemaSkippedRepos(item.skippedRepos),
      }),
    };
  }

  public static fromSchemaVariantAnalysisDatabases(
    item: VariantAnalysisDatabasesSchema,
  ) {
    return {
      ...(item.repositories.length > 0 && { repositories: item.repositories }),
      ...(item.repositoryLists.length > 0 && {
        repositoryLists: item.repositoryLists,
      }),
      ...(item.repositoryOwners.length > 0 && {
        repositoryOwners: item.repositoryOwners,
      }),
    };
  }

  public static fromSchemaRepository(item: RepositorySchema): Repository {
    return {
      id: Number(item.id),
      fullName: item.fullName,
      private: item.private,
    };
  }

  public static fromSchemaSkippedRepos(
    item: SkippedRepoSchema,
  ): VariantAnalysisSkippedRepositories {
    return {
      accessMismatchRepos: item.accessMismatchRepos
        ? this.fromSchemaSkippedRepoGroup(item?.accessMismatchRepos)
        : undefined,
      notFoundRepos: item.notFoundRepos
        ? this.fromSchemaSkippedRepoGroup(item?.notFoundRepos)
        : undefined,
      noCodeqlDbRepos: item.noCodeqlDbRepos
        ? this.fromSchemaSkippedRepoGroup(item?.noCodeqlDbRepos)
        : undefined,
      overLimitRepos: item.overLimitRepos
        ? this.fromSchemaSkippedRepoGroup(item?.overLimitRepos)
        : undefined,
    };
  }

  public static fromSchemaScannedRepo(
    item: ScannedRepoSchema,
  ): VariantAnalysisScannedRepository {
    return {
      repository: this.fromSchemaRepositoryWithMetadata(
        item.repository as RepositoryWithMetadataSchema,
      ),
      analysisStatus: item.analysisStatus as VariantAnalysisRepoStatus,
      ...(item.resultCount && { resultCount: item.resultCount }),
      ...(item.artifactSizeInBytes && {
        artifactSizeInBytes: item.artifactSizeInBytes,
      }),
      ...(item.failureMessage && { failureMessage: item.failureMessage }),
    };
  }

  public static fromSchemaRepositoryWithMetadata(
    item: RepositoryWithMetadataSchema,
  ): RepositoryWithMetadata {
    return {
      id: Number(item.id),
      fullName: item.fullName,
      private: item.private,
      stargazersCount: item.stargazersCount,
      updatedAt: item.updatedAt || null,
    };
  }

  public static fromSchemaSkippedRepoGroup(
    item: SkippedRepoGroupSchema,
  ): VariantAnalysisSkippedRepositoryGroup {
    return {
      repositoryCount: item.repositoryCount,
      repositories: item.repositories.map((r) => this.fromSchemaSkippedRepo(r)),
    };
  }

  public static fromSchemaSkippedRepo(
    item: VariantAnalysisSkippedRepoSchema,
  ): VariantAnalysisSkippedRepository {
    return {
      ...(item.id && { id: Number(item?.id) }),
      fullName: item.fullName,
      ...(item.private !== undefined && { private: item.private }),
      ...(item.stargazersCount && { stargazersCount: item.stargazersCount }),
      ...(item.updatedAt && { updatedAt: item.updatedAt }),
    };
  }
}
