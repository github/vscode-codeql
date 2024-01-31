import type { Method } from "./method";
import type { ModeledMethod } from "./modeled-method";
import type { BaseLogger } from "../common/logging";

interface Notifier {
  missingMethod(
    signature: string,
    modeledMethods: readonly ModeledMethod[],
  ): void;
  inconsistentSupported(signature: string, expectedSupported: boolean): void;
}

export function checkConsistency(
  methods: readonly Method[],
  modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  notifier: Notifier,
) {
  const methodsBySignature = methods.reduce(
    (acc, method) => {
      acc[method.signature] = method;
      return acc;
    },
    {} as Record<string, Method>,
  );

  for (const signature in modeledMethods) {
    const modeledMethodsForSignature = modeledMethods[signature];

    const method = methodsBySignature[signature];
    if (!method) {
      notifier.missingMethod(signature, modeledMethodsForSignature);
      continue;
    }

    checkMethodConsistency(method, modeledMethodsForSignature, notifier);
  }
}

function checkMethodConsistency(
  method: Method,
  modeledMethods: readonly ModeledMethod[],
  notifier: Notifier,
) {
  // Type models are currently not shown as `supported` since they do not give any model information.
  const expectSupported = modeledMethods.some(
    (m) => m.type !== "none" && m.type !== "type",
  );

  if (method.supported !== expectSupported) {
    notifier.inconsistentSupported(method.signature, expectSupported);
  }
}

export class DefaultNotifier implements Notifier {
  constructor(private readonly logger: BaseLogger) {}

  missingMethod(signature: string, modeledMethods: readonly ModeledMethod[]) {
    const modelTypes = modeledMethods
      .map((m) => m.type)
      .filter((t) => t !== "none")
      .join(", ");

    void this.logger.log(
      `Model editor query consistency check: Missing method ${signature} for method that is modeled as ${modelTypes}`,
    );
  }

  inconsistentSupported(signature: string, expectedSupported: boolean) {
    const expectedMessage = expectedSupported
      ? `Expected method to be supported, but it is not.`
      : `Expected method to not be supported, but it is.`;

    void this.logger.log(
      `Model editor query consistency check: Inconsistent supported flag for method ${signature}. ${expectedMessage}`,
    );
  }
}
