import * as t from "io-ts";
import { pipe } from "fp-ts/function";
import { fold, isLeft } from "fp-ts/Either";

// Most of these functions are copied from https://github.com/gcanti/io-ts/blob/9103e887387559d5d273036fa0788e67e210a322/src/PathReporter.ts
// The main difference between the included PathReporter and the one below is that the PathReporter
// will produce a path in the error message like "{ userId: number, name: string }/userId" whereas
// the below will produce a path like "userId". For nested structures with intersections/unions,
// this makes the error messages much more readable.

function stringify(v: any): string {
  if (typeof v === "function") {
    return t.getFunctionName(v);
  }
  if (typeof v === "number" && !isFinite(v)) {
    if (isNaN(v)) {
      return "NaN";
    }
    return v > 0 ? "Infinity" : "-Infinity";
  }
  return JSON.stringify(v);
}

function getContextPath(context: t.Context): string {
  return context.map(({ key }) => key).join(".");
}

function getMessage(e: t.ValidationError): string {
  return e.message !== undefined
    ? e.message
    : `Invalid value ${stringify(e.value)} supplied to ${getContextPath(
        e.context,
      )}`;
}

const getErrors = <A>(v: t.Validation<A>): string[] => {
  return pipe(
    v,
    fold(
      (errors) => errors.map(getMessage),
      () => ["no errors"],
    ),
  );
};

export function validateApiResponse<T extends t.Any>(
  data: unknown,
  type: T,
): t.TypeOf<T> {
  const result = type.decode(data);
  if (isLeft(result)) {
    throw new Error(
      `Invalid response from GitHub API: ${getErrors(result).join(", ")}`,
    );
  }
  return result.right;
}
