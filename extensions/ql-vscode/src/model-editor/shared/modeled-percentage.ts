import { Method } from "../method";

export function calculateModeledPercentage(
  methods: Array<Pick<Method, "supported">>,
): number {
  if (methods.length === 0) {
    return 0;
  }

  const modeledMethods = methods.filter((m) => m.supported);

  const modeledRatio = modeledMethods.length / methods.length;
  return modeledRatio * 100;
}
