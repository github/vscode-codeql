/**
 * An interface to help keep track of which methods are in progress for each package.
 */
export type InProgressMethods = Record<string, string[]>;

export function setPackageInProgressMethods(
  inProgressMethods: InProgressMethods,
  packageName: string,
  methods: string[],
): InProgressMethods {
  return {
    ...inProgressMethods,
    [packageName]: methods,
  };
}

export function hasInProgressMethod(
  inProgressMethods: InProgressMethods,
  packageName: string,
  method: string,
): boolean {
  const methods = inProgressMethods[packageName];
  if (methods) {
    return methods.includes(method);
  }

  return false;
}
