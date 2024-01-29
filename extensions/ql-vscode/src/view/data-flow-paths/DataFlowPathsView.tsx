import { useEffect, useState } from "react";
import type { ToDataFlowPathsMessage } from "../../common/interface-types";
import type { DataFlowPaths as DataFlowPathsDomainModel } from "../../variant-analysis/shared/data-flow-paths";
import { DataFlowPaths } from "./DataFlowPaths";

export type DataFlowPathsViewProps = {
  dataFlowPaths?: DataFlowPathsDomainModel;
};

export function DataFlowPathsView({
  dataFlowPaths: initialDataFlowPaths,
}: DataFlowPathsViewProps): React.JSX.Element {
  const [dataFlowPaths, setDataFlowPaths] = useState<
    DataFlowPathsDomainModel | undefined
  >(initialDataFlowPaths);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToDataFlowPathsMessage = evt.data;
        if (msg.t === "setDataFlowPaths") {
          setDataFlowPaths(msg.dataFlowPaths);

          // Scroll to the top of the page when we're rendering
          // new data flow paths.
          window.scrollTo(0, 0);
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  if (!dataFlowPaths) {
    return <>Loading data flow paths</>;
  }

  return <DataFlowPaths dataFlowPaths={dataFlowPaths} />;
}
