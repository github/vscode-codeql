import type { ComparePerformanceDescriptionData } from "../../log-insights/performance-comparison";
import { ComparePerformanceLocalRunDescription } from "./ComparePerformanceLocalRunDescription";
import { ComparePerformanceRemoteLogsDescription } from "./ComparePerformanceRemoteLogsDescription";

type Props = ComparePerformanceDescriptionData;

export const ComparePerformanceDescription = (props: Props) => {
  return props.kind === "remote-logs" ? (
    <ComparePerformanceRemoteLogsDescription {...props} />
  ) : (
    <ComparePerformanceLocalRunDescription {...props} />
  );
};
