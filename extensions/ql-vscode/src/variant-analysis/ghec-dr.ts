import {
  VARIANT_ANALYSIS_ENABLE_GHEC_DR,
  hasEnterpriseUri,
  hasGhecDrUri,
} from "../config";

/**
 * Determines whether MRVA should be enabled or not for the current GitHub host.
 * This is based on the `github-enterprise.uri` setting.
 */
export function isVariantAnalysisEnabledForGitHubHost(): boolean {
  return (
    // MRVA is always enabled on github.com
    !hasEnterpriseUri() ||
    // MRVA can be enabled on GHEC-DR using a feature flag
    (hasGhecDrUri() && !!VARIANT_ANALYSIS_ENABLE_GHEC_DR.getValue<boolean>())
  );
}
