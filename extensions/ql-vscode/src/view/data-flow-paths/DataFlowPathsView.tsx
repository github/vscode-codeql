import { useState } from "react";
import type { ToDataFlowPathsMessage } from "../../common/interface-types";
import type { DataFlowPaths as DataFlowPathsDomainModel } from "../../variant-analysis/shared/data-flow-paths";
import { DataFlowPaths } from "./DataFlowPaths";
import { useMessageFromExtension } from "../common/useMessageFromExtension";

export type DataFlowPathsViewProps = {
  dataFlowPaths?: DataFlowPathsDomainModel;
};

export function DataFlowPathsView({
  dataFlowPaths: initialDataFlowPaths,
}: DataFlowPathsViewProps): React.JSX.Element {
  const [dataFlowPaths, setDataFlowPaths] = useState<
    DataFlowPathsDomainModel | undefined
  >(initialDataFlowPaths);

  useMessageFromExtension<ToDataFlowPathsMessage>((msg) => {
    setDataFlowPaths(msg.dataFlowPaths);

    // Scroll to the top of the page when we're rendering
    // new data flow paths.
    window.scrollTo(0, 0);
  }, []);

  if (!dataFlowPaths) {
    return <>Loading data flow paths</>;
  }

  return <DataFlowPaths dataFlowPaths={dataFlowPaths} />;
}
