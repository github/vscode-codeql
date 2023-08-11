/**
 * A class that keeps track of which methods are in progress for each package.
 */
export class InProgressMethods {
  // A map of in-progress method signatures for each package.
  private readonly methodMap: Map<string, Set<string>>;

  constructor() {
    this.methodMap = new Map<string, Set<string>>();
  }

  public setPackageMethods(packageName: string, methods: Set<string>): void {
    this.methodMap.set(packageName, methods);
  }

  public hasMethod(packageName: string, method: string): boolean {
    const methods = this.methodMap.get(packageName);
    if (methods) {
      return methods.has(method);
    }
    return false;
  }

  public static fromExisting(methods: InProgressMethods): InProgressMethods {
    const newInProgressMethods = new InProgressMethods();
    methods.methodMap.forEach((value, key) => {
      newInProgressMethods.methodMap.set(key, new Set<string>(value));
    });
    return newInProgressMethods;
  }
}
