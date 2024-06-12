import { hasEnterpriseUri, hasGhecDrUri } from "../config";

/**
 * Determines whether MRVA should be enabled or not for the current GitHub host.
 * MRVA is enabled on github.com and GHEC-DR.
 * This is based on the `github-enterprise.uri` setting.
 */
export function isVariantAnalysisEnabledForGitHubHost(): boolean {
  return !hasEnterpriseUri() || hasGhecDrUri();
}
