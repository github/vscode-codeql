import { Mode } from "./shared/mode";
import { assertNever } from "../common/helpers-pure";

export function modeTag(mode: Mode): string {
  switch (mode) {
    case Mode.Application:
      return "application-mode";
    case Mode.Framework:
      return "framework-mode";
    default:
      assertNever(mode);
  }
}
