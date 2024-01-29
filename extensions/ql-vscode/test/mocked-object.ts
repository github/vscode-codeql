export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

type DynamicProperties<T extends object> = {
  [P in keyof T]?: () => T[P];
};

type MockedObjectOptions<T extends object> = {
  /**
   * Properties for which the given method should be called when accessed.
   * The method should return the value to be returned when the property is accessed.
   * Methods which are explicitly defined in `methods` will take precedence over
   * dynamic properties.
   */
  dynamicProperties?: DynamicProperties<T>;
};

export function mockedObject<T extends object>(
  props: DeepPartial<T>,
  { dynamicProperties }: MockedObjectOptions<T> = {},
): T {
  return new Proxy<T>({} as unknown as T, {
    get: (_target, prop) => {
      if (prop in props) {
        return (props as any)[prop];
      }
      if (dynamicProperties && prop in dynamicProperties) {
        return (dynamicProperties as any)[prop]();
      }

      // The `then` method is accessed by `Promise.resolve` to check if the object is a thenable.
      // We don't want to throw an error when this happens.
      if (prop === "then") {
        return undefined;
      }

      // The `asymmetricMatch` is accessed by jest to check if the object is a matcher.
      // We don't want to throw an error when this happens.
      if (prop === "asymmetricMatch") {
        return undefined;
      }

      // The `Symbol.iterator` is accessed by jest to check if the object is iterable.
      // We don't want to throw an error when this happens.
      if (prop === Symbol.iterator) {
        return undefined;
      }

      // The `$$typeof` is accessed by jest to check if the object is a React element.
      // We don't want to throw an error when this happens.
      if (prop === "$$typeof") {
        return undefined;
      }

      // The `nodeType` and `tagName` are accessed by jest to check if the object is a DOM node.
      // We don't want to throw an error when this happens.
      if (prop === "nodeType" || prop === "tagName") {
        return undefined;
      }

      // The `@@__IMMUTABLE_ITERABLE__@@` and variants are accessed by jest to check if the object is an
      // immutable object (from Immutable.js).
      // We don't want to throw an error when this happens.
      if (prop.toString().startsWith("@@__IMMUTABLE_")) {
        return undefined;
      }

      // The `Symbol.toStringTag` is accessed by jest.
      // We don't want to throw an error when this happens.
      if (prop === Symbol.toStringTag) {
        return "MockedObject";
      }

      throw new Error(`Method ${String(prop)} not mocked`);
    },
  });
}
