import type { KeyboardEvent } from "react";
import { useMemo } from "react";
import type {
  ElementProps,
  FloatingContext,
  ReferenceType,
} from "@floating-ui/react";
import { isReactEvent } from "@floating-ui/react/utils";
import { useEffectEvent } from "./useEffectEvent";

/**
 * Open the floating element when Ctrl+Space is pressed.
 */
export const useOpenKey = <RT extends ReferenceType = ReferenceType>(
  context: FloatingContext<RT>,
): ElementProps => {
  const { open, onOpenChange } = context;

  const openOnOpenKey = useEffectEvent(
    (event: KeyboardEvent<Element> | KeyboardEvent) => {
      if (open) {
        return;
      }

      if (
        event.key === " " &&
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        onOpenChange(true, isReactEvent(event) ? event.nativeEvent : event);
      }
    },
  );

  return useMemo((): ElementProps => {
    return {
      reference: {
        onKeyDown: openOnOpenKey,
      },
    };
  }, [openOnOpenKey]);
};
