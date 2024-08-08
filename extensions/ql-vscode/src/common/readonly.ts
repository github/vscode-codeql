export type DeepReadonly<T> =
  T extends Array<infer R>
    ? DeepReadonlyArray<R>
    : // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      T extends Function
      ? T
      : T extends object
        ? DeepReadonlyObject<T>
        : T;

type DeepReadonlyArray<T> = ReadonlyArray<DeepReadonly<T>>;

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
