/**
 * A class that keeps track of which methods are in progress for each package.
 *
 * This class is immutable and therefore is safe to be used in a react useState hook.
 */
export class InProgressMethods {
  // A map of in-progress method signatures for each package.
  private readonly methodMap: ReadonlyMap<string, Set<string>>;

  constructor(methodMap?: ReadonlyMap<string, Set<string>>) {
    this.methodMap = methodMap ?? new Map<string, Set<string>>();
  }

  /**
   * Sets the in-progress methods for the given package.
   * Returns a new InProgressMethods instance.
   */
  public setPackageMethods(
    packageName: string,
    methods: Set<string>,
  ): InProgressMethods {
    const newMethodMap = new Map<string, Set<string>>();
    this.methodMap.forEach((value, key) => {
      newMethodMap.set(key, new Set<string>(value));
    });
    newMethodMap.set(packageName, methods);
    return new InProgressMethods(newMethodMap);
  }

  public hasMethod(packageName: string, method: string): boolean {
    const methods = this.methodMap.get(packageName);
    if (methods) {
      return methods.has(method);
    }
    return false;
  }
}
