import {
  hasEnterpriseUri,
  hasGhecDrUri,
  isVariantAnalysisServerConfigured,
} from "../config";

/**
 * Determines whether MRVA should be enabled or not for the current GitHub host.
 * MRVA is enabled on github.com and GHEC-DR.
 * This is based on the `github-enterprise.uri` setting.
 * It is also enabled when an internal custom variant analysis server is configured.
 */
export function isVariantAnalysisEnabledForGitHubHost(): boolean {
  return (
    !hasEnterpriseUri() || hasGhecDrUri() || isVariantAnalysisServerConfigured()
  );
}
