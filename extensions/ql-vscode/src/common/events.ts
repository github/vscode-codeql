import { Disposable } from "../pure/disposable-object";

export interface AppEvent<T> {
  (listener: (event: T) => void): Disposable;
}

export interface AppEventEmitter<T> {
  event: AppEvent<T>;
  fire(data: T): void;
}
