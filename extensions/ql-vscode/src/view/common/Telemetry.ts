import * as React from "react";
import { useState } from "react";
import { vscode } from "../vscode-api";

/**
 * Wraps `React.useState` to output telemetry events whenever the value changes.
 *
 * The only catch is that when using a predicate to filter which values output telemetry,
 * the setter only accepts a raw value, instead of a `(prevState: S) => S` function.
 *
 * @param defaultValue Default value to pass to React.useState
 * @param telemetryAction Name of the telemetry event to output
 * @param filterTelemetryOnValue If provided, only output telemetry events when the predicate returns true. If not provided always outputs telemetry.
 * @returns A value and a setter function, just as if from `React.useState`
 */
export function useStateWithTelemetry<S>(
  defaultValue: S | (() => S),
  telemetryAction: string,
): [S, React.Dispatch<React.SetStateAction<S>>];
export function useStateWithTelemetry<S>(
  defaultValue: S | (() => S),
  telemetryAction: string,
  filterTelemetryOnValue: (value: S) => boolean,
): [S, React.Dispatch<S>];
export function useStateWithTelemetry<S>(
  defaultValue: S | (() => S),
  telemetryAction: string,
  filterTelemetryOnValue?: (value: S) => boolean,
): [S, React.Dispatch<S> | React.Dispatch<React.SetStateAction<S>>] {
  const [value, setter] = useState<S>(defaultValue);
  const setterWithTelemetry = React.useMemo<
    React.Dispatch<S> | React.Dispatch<React.SetStateAction<S>>
  >(() => {
    if (filterTelemetryOnValue === undefined) {
      return (x: React.SetStateAction<S>) => {
        vscode.postMessage({
          t: "telemetry",
          action: telemetryAction,
        });
        setter(x);
      };
    } else {
      return (x: S) => {
        if (filterTelemetryOnValue(x)) {
          vscode.postMessage({
            t: "telemetry",
            action: telemetryAction,
          });
        }
        setter(x);
      };
    }
  }, [telemetryAction, filterTelemetryOnValue, setter]);
  return [value, setterWithTelemetry];
}
