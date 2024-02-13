import { useCallback, useInsertionEffect, useRef } from "react";

// Copy of https://github.com/floating-ui/floating-ui/blob/5d025db1167e0bc13e7d386d7df2498b9edf2f8a/packages/react/src/hooks/utils/useEffectEvent.ts
// since it's not exported

/**
 * Creates a reference to a callback that will never change in value. This will ensure that when a callback gets changed,
 * no new reference to the callback will be created and thus no unnecessary re-renders will be triggered.
 *
 * @param callback The callback to call when the event is triggered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEffectEvent<T extends (...args: any[]) => any>(callback: T) {
  const ref = useRef<T>(callback);

  useInsertionEffect(() => {
    ref.current = callback;
  });

  return useCallback<(...args: Parameters<T>) => ReturnType<T>>(
    (...args) => ref.current(...args),
    [],
  ) as T;
}
