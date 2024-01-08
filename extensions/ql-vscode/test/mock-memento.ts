import type { Memento } from "../src/common/memento";

export function createMockMemento(): Memento {
  return new MockMemento();
}

class MockMemento<T> implements Memento {
  private readonly map: Map<string, T>;

  constructor() {
    this.map = new Map<string, T>();
  }

  public keys(): readonly string[] {
    return Array.from(this.map.keys());
  }

  public get<T>(key: string): T | undefined;
  public get<T>(key: string, defaultValue: T): T;
  public get(key: any, defaultValue?: any): T | T | undefined {
    return this.map.get(key) || defaultValue;
  }

  public update(key: string, value: any): Thenable<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }
}
