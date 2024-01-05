import { EventEmitter } from "vscode";
import type { AppEventEmitter } from "../events";

export class VSCodeAppEventEmitter<T>
  extends EventEmitter<T>
  implements AppEventEmitter<T> {}
