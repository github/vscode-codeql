export function expectArraysEqual<T>(actual: T[], expected: T[]) {
  // Check that all of the expected values are present
  expect(actual).toEqual(expect.arrayContaining(expected));
  // Check that no extra un-expected values are present
  expect(expected).toEqual(expect.arrayContaining(actual));
}
