import * as React from "react";
import { useEffect, useState } from "react";
import { ToDataFlowPathsMessage } from "../../pure/interface-types";
import { DataFlowPaths } from "../../variant-analysis/shared/data-flow-paths";

export type DataFlowPathsViewProps = {
  dataFlowPaths?: DataFlowPaths;
};

export function DataFlowPathsView({
  dataFlowPaths: initialDataFlowPaths,
}: DataFlowPathsViewProps): JSX.Element {
  const [dataFlowPaths, setDataFlowPaths] = useState<DataFlowPaths | undefined>(
    initialDataFlowPaths,
  );

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToDataFlowPathsMessage = evt.data;
        if (msg.t === "setDataFlowPaths") {
          setDataFlowPaths(msg.dataFlowPaths);
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

  // For now, just render the data flows as JSON.
  return (
    <>
      Loaded
      <pre>{JSON.stringify(dataFlowPaths)}</pre>
    </>
  );
}
