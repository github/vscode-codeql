import type { ComparePerformanceDescriptionData } from "../../log-insights/performance-comparison";

type Props = ComparePerformanceDescriptionData & {
  kind: "local-run";
};

export const ComparePerformanceLocalRunDescription = ({
  fromQuery,
  toQuery,
}: Props) => {
  return (
    <div>
      <strong>
        Comparison of local runs of {fromQuery} and {toQuery}
      </strong>
    </div>
  );
};
