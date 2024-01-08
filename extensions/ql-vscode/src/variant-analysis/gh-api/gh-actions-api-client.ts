import type { Credentials } from "../../common/authentication";
import type { VariantAnalysis } from "../shared/variant-analysis";

export async function cancelVariantAnalysis(
  credentials: Credentials,
  variantAnalysis: VariantAnalysis,
): Promise<void> {
  const octokit = await credentials.getOctokit();
  const {
    actionsWorkflowRunId,
    controllerRepo: { fullName },
  } = variantAnalysis;
  const response = await octokit.request(
    `POST /repos/${fullName}/actions/runs/${actionsWorkflowRunId}/cancel`,
  );
  if (response.status >= 300) {
    throw new Error(
      `Error cancelling variant analysis: ${response.status} ${
        response?.data?.message || ""
      }`,
    );
  }
}
