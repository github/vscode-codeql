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
      (fromQuery?
      <strong>
        Comparison of local runs of {fromQuery} and {toQuery}
      </strong>
      : Local run of {toQuery})
    </div>
  );
};
