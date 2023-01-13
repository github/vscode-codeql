import { useEffect, useRef } from "react";
import { vscode } from "../vscode-api";

/**
 * A react effect that outputs telemetry events whenever the value changes.
 *
 * @param value Default value to pass to React.useState
 * @param telemetryAction Name of the telemetry event to output
 * @param options Extra optional arguments, including:
 *   filterTelemetryOnValue: If provided, only output telemetry events when the
 *       predicate returns true. If not provided always outputs telemetry.
 */
export function useTelemetryOnChange<S>(
  value: S,
  telemetryAction: string,
  options?: {
    filterTelemetryOnValue?: (value: S) => boolean;
  },
) {
  const previousValue = useRef(value);
  const filterTelemetryOnValue = options?.filterTelemetryOnValue;

  useEffect(() => {
    if (value === previousValue.current) {
      return;
    }
    previousValue.current = value;

    if (filterTelemetryOnValue && !filterTelemetryOnValue(value)) {
      return;
    }

    sendTelemetry(telemetryAction);
  }, [telemetryAction, filterTelemetryOnValue, value, previousValue]);
}

export function sendTelemetry(telemetryAction: string) {
  vscode.postMessage({
    t: "telemetry",
    action: telemetryAction,
  });
}
