import type { RefObject } from "react";
import { useEffect } from "react";

export function useScrollIntoView<T>(
  selectedElement: T | undefined,
  selectedElementRef: RefObject<HTMLElement>,
) {
  useEffect(() => {
    const element = selectedElementRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    // The selected item's bounding box might be on screen, but hidden underneath the sticky header
    // which overlaps the table view. As a workaround we hardcode a fixed distance from the top which
    // we consider to be obscured. It does not have to exact, as it's just a threshold for when to scroll.
    const heightOfStickyHeader = 30;
    if (rect.top < heightOfStickyHeader || rect.bottom > window.innerHeight) {
      element.scrollIntoView({
        block: "center", // vertically align to center
      });
    }
    if (rect.left < 0 || rect.right > window.innerWidth) {
      element.scrollIntoView({
        block: "nearest",
        inline: "nearest", // horizontally align as little as possible
      });
    }
  }, [selectedElement, selectedElementRef]);
}
