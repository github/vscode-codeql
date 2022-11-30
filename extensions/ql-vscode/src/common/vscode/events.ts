import { EventEmitter } from "vscode";
import { AppEventEmitter } from "../events";

export class VSCodeAppEventEmitter<T>
  extends EventEmitter<T>
  implements AppEventEmitter<T> {}
