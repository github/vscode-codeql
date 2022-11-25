import * as vscode from "vscode";
import { AppEventEmitter } from "../events";

export class VSCodeAppEventEmitter<T>
  extends vscode.EventEmitter<T>
  implements AppEventEmitter<T> {}
