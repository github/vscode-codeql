import type { KeyboardEvent } from "react";
import { useMemo } from "react";
import type {
  ElementProps,
  FloatingContext,
  ReferenceType,
} from "@floating-ui/react";
import { isReactEvent } from "@floating-ui/react/utils";
import { useEffectEvent } from "./useEffectEvent";

export interface UseOpenKeyProps {
  enabled?: boolean;
}

/**
 * Open the floating element when Ctrl+Space or Cmd+Space is pressed.
 */
export const useOpenKey = <RT extends ReferenceType = ReferenceType>(
  context: FloatingContext<RT>,
  props: UseOpenKeyProps = {},
): ElementProps => {
  const { open, onOpenChange } = context;
  const { enabled = true } = props;

  const openOnOpenKey = useEffectEvent(
    (event: KeyboardEvent<Element> | KeyboardEvent) => {
      if (open || !enabled) {
        return;
      }

      if (event.key === " " && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onOpenChange(true, isReactEvent(event) ? event.nativeEvent : event);
      }
    },
  );

  return useMemo((): ElementProps => {
    if (!enabled) {
      return {};
    }

    return {
      reference: {
        onKeyDown: openOnOpenKey,
      },
    };
  }, [enabled, openOnOpenKey]);
};
