export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export function mockedObject<T extends object>(props: DeepPartial<T>): T {
  return new Proxy<T>({} as unknown as T, {
    get: (_target, prop) => {
      if (prop in props) {
        return (props as any)[prop];
      }
      throw new Error(`Method ${String(prop)} not mocked`);
    },
  });
}
