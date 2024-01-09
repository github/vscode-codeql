import type { NavigateMsg } from "../../common/interface-types";
import { EventHandlers as EventHandlerList } from "./event-handler-list";

/**
 * Event handlers to be notified of navigation events coming from outside the webview.
 */
export const onNavigation = new EventHandlerList<NavigateMsg>();
