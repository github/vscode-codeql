type VariantId = string;
type SourceId = string;
type TargetId = string;

type TargetInfo = {
  target_id: TargetId;
  variant_id: VariantId;
  source_id: SourceId;
};

type SourceInfo = {
  source_id: SourceId;
  repository: string;
  sha: string;
};

export type ArtifactDownload = {
  repository: string;
  run_id: number;
  artifact_name: string;
};

type TargetDownloads = {
  "evaluator-logs": ArtifactDownload;
};

export type MinimalDownloadsType = {
  sources: {
    [source: SourceId]: { info: SourceInfo };
  };
  targets: {
    [target: string]: {
      info: TargetInfo;
      downloads: TargetDownloads;
    };
  };
};

export const dcaControllerRepository = {
  owner: "github",
  repo: "codeql-dca-main",
};
