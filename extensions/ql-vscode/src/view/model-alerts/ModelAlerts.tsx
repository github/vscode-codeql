import { useEffect, useState } from "react";
import { ModelAlertsHeader } from "./ModelAlertsHeader";
import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import type { ToModelAlertsMessage } from "../../common/interface-types";

type Props = {
  initialViewState?: ModelAlertsViewState;
};

export function ModelAlerts({ initialViewState }: Props): React.JSX.Element {
  const [viewState, setViewState] = useState<ModelAlertsViewState | undefined>(
    initialViewState,
  );

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToModelAlertsMessage = evt.data;
        switch (msg.t) {
          case "setModelAlertsViewState": {
            setViewState(msg.viewState);
            break;
          }
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

  if (viewState === undefined) {
    return <></>;
  }

  return <ModelAlertsHeader viewState={viewState}></ModelAlertsHeader>;
}
