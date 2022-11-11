import { App } from '../app';
import { AppEventEmitter } from '../events';
import { VSCodeAppEventEmitter } from './events';

export class ExtensionApp implements App {
  public createEventEmitter<T>(): AppEventEmitter<T> {
    return new VSCodeAppEventEmitter<T>();
  }
}
