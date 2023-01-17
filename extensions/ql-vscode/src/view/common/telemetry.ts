import { useEffect, useMemo, useRef } from "react";
import { vscode } from "../vscode-api";

/**
 * A react effect that outputs telemetry events whenever the value changes.
 *
 * @param value Default value to pass to React.useState
 * @param telemetryAction Name of the telemetry event to output
 * @param options Extra optional arguments, including:
 *   filterTelemetryOnValue: If provided, only output telemetry events when the
 *       predicate returns true. If not provided always outputs telemetry.
 *   debounceTimeout: If provided, will not output telemetry events for every change
 *       but will wait until specified timeout happens with no new events ocurring.
 */
export function useTelemetryOnChange<S>(
  value: S,
  telemetryAction: string,
  {
    filterTelemetryOnValue,
    debounceTimeoutMillis,
  }: {
    filterTelemetryOnValue?: (value: S) => boolean;
    debounceTimeoutMillis?: number;
  } = {},
) {
  const previousValue = useRef(value);

  const sendTelemetryFunc = useMemo<() => void>(() => {
    if (debounceTimeoutMillis === undefined) {
      return () => sendTelemetry(telemetryAction);
    } else {
      let timer: NodeJS.Timeout;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          sendTelemetry(telemetryAction);
        }, debounceTimeoutMillis);
      };
    }
  }, [telemetryAction, debounceTimeoutMillis]);

  useEffect(() => {
    if (value === previousValue.current) {
      return;
    }
    previousValue.current = value;

    if (filterTelemetryOnValue && !filterTelemetryOnValue(value)) {
      return;
    }

    sendTelemetryFunc();
  }, [sendTelemetryFunc, filterTelemetryOnValue, value, previousValue]);
}

export function sendTelemetry(telemetryAction: string) {
  vscode.postMessage({
    t: "telemetry",
    action: telemetryAction,
  });
}
