import * as React from "react";

/**
 * Some book-keeping needed to scroll a specific HTML element into view in a React component.
 */
export class ScrollIntoViewHelper {
  private selectedElementRef = React.createRef<HTMLElement | any>(); // need 'any' to work around typing bug in React
  private shouldScrollIntoView = true;

  /**
   * If `isSelected` is true, gets the `ref={}` attribute to use for an element that we might want to scroll into view.
   */
  public ref(isSelected: boolean) {
    return isSelected ? this.selectedElementRef : undefined;
  }

  /**
   * Causes the element whose `ref={}` was set to be scrolled into view after the next render.
   */
  public scrollIntoViewOnNextUpdate() {
    this.shouldScrollIntoView = true;
  }

  /**
   * Should be called from `componentDidUpdate` and `componentDidMount`.
   *
   * Scrolls the component into view if requested.
   */
  public update() {
    if (!this.shouldScrollIntoView) {
      return;
    }
    this.shouldScrollIntoView = false;
    const element = this.selectedElementRef.current as HTMLElement | null;
    if (element == null) {
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
  }
}
