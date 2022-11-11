import { AppEventEmitter } from './events';

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
}
