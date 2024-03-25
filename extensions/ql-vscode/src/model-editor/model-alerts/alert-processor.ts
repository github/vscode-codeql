import type { AnalysisAlert } from "../../variant-analysis/shared/analysis-result";
import type { ModeledMethod } from "../modeled-method";
import { EndpointType } from "../method";
import type { ModelAlerts } from "./model-alerts";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
} from "../../variant-analysis/shared/variant-analysis";

/**
 * Calculate which model has contributed to each alert.
 * @param alerts The alerts to process.
 * @param repoResults The analysis results for each repo.
 * @returns The alerts grouped by modeled method.
 */
export function calculateModelAlerts(
  variantAnalysis: VariantAnalysis,
  repoResults: VariantAnalysisScannedRepositoryResult[],
): ModelAlerts[] {
  // For now we just return some mock data, but once we have provenance information
  // we'll be able to calculate this properly based on the alerts that are passed in
  // and potentially some other information.

  const modelAlerts: ModelAlerts[] = [];

  const repoMap = new Map<number, string>();
  for (const scannedRepo of variantAnalysis.scannedRepos || []) {
    repoMap.set(scannedRepo.repository.id, scannedRepo.repository.fullName);
  }

  for (const [i, repoResult] of repoResults.entries()) {
    const results = repoResult.interpretedResults || [];
    const repository = {
      id: repoResult.repositoryId,
      fullName: repoMap.get(repoResult.repositoryId) || "",
    };

    const alerts = results.map(() => {
      return {
        alert: createMockAlert(),
        repository,
      };
    });

    modelAlerts.push({
      model: createModeledMethod(i.toString()),
      alerts,
    });
  }

  return modelAlerts;
}

function createModeledMethod(suffix: string): ModeledMethod {
  return {
    libraryVersion: "1.6.0",
    signature: `org.sql2o.Connection#createQuery${suffix}(String)`,
    endpointType: EndpointType.Method,
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: `createQuery${suffix}`,
    methodParameters: "(String)",
    type: "sink",
    input: "Argument[0]",
    kind: "path-injection",
    provenance: "manual",
  };
}

function createMockAlert(): AnalysisAlert {
  return {
    message: {
      tokens: [
        {
          t: "text",
          text: "This is an empty block.",
        },
      ],
    },
    shortDescription: "This is an empty block.",
    fileLink: {
      fileLinkPrefix:
        "https://github.com/expressjs/express/blob/33e8dc303af9277f8a7e4f46abfdcb5e72f6797b",
      filePath: "test/app.options.js",
    },
    severity: "Warning",
    codeSnippet: {
      startLine: 10,
      endLine: 14,
      text: "    app.del('/', function(){});\n    app.get('/users', function(req, res){});\n    app.put('/users', function(req, res){});\n\n    request(app)\n",
    },
    highlightedRegion: {
      startLine: 12,
      startColumn: 41,
      endLine: 12,
      endColumn: 43,
    },
    codeFlows: [],
  };
}
