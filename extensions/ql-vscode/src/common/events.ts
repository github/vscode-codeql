import type { Disposable } from "./disposable-object";

export interface AppEvent<T> {
  (listener: (event: T) => void): Disposable;
}

export interface AppEventEmitter<T> extends Disposable {
  event: AppEvent<T>;
  fire(data: T): void;
}
