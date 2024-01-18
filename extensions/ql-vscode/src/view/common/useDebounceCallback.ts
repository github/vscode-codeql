import { useEffect, useRef } from "react";

/**
 * Call the callback after the value has not changed for a certain amount of time.
 * @param value
 * @param callback
 * @param delay
 */
export function useDebounceCallback<T>(
  value: T,
  callback: (value: T) => void,
  delay?: number,
) {
  const callbackRef = useRef<(value: T) => void>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timer = setTimeout(() => callbackRef.current(value), delay || 500);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
}
