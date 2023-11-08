import { useCallback, useInsertionEffect, useRef } from "react";

type AnyFunction = (...args: any[]) => any;

// Copy of https://github.com/floating-ui/floating-ui/blob/a70e4e2350627ba61bdfd72f86475d0905c2a17e/packages/react/src/hooks/utils/useEffectEvent.ts
// since it's not exported

/**
 * Creates a reference to a callback that will never change in value. This will ensure that when a callback gets changed,
 * no new reference to the callback will be created and thus no unnecessary re-renders will be triggered.
 *
 * @param callback The callback to call when the event is triggered.
 */
export function useEffectEvent<T extends AnyFunction>(callback?: T) {
  const ref = useRef<AnyFunction | undefined>(() => {});

  useInsertionEffect(() => {
    ref.current = callback;
  });

  return useCallback<AnyFunction>((...args) => ref.current?.(...args), []) as T;
}
