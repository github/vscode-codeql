/**
 * Remove all readonly modifiers from a type.
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
