/**
 * An interface to help keep track of which methods are in progress for each package.
 */
export type InProgressMethods = Readonly<Record<string, readonly string[]>>;

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

export function hasInProgressMethodSignature(
  inProgressMethods: InProgressMethods,
  signature: string,
): boolean {
  for (const methods of Object.values(inProgressMethods)) {
    if (methods.includes(signature)) {
      return true;
    }
  }

  return false;
}
