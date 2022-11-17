export type RemoteQueryWorkflowStatus =
  | "InProgress"
  | "CompletedSuccessfully"
  | "CompletedUnsuccessfully"
  | "Cancelled";

export interface RemoteQueryWorkflowResult {
  status: RemoteQueryWorkflowStatus;
  error?: string;
}
