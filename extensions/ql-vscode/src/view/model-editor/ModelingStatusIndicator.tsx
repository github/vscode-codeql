import { assertNever } from "../../common/helpers-pure";
import { Codicon } from "../common/icon/Codicon";
import type { ModelingStatus } from "../../model-editor/shared/modeling-status";

interface Props {
  status: ModelingStatus;
}

export function ModelingStatusIndicator({ status }: Props) {
  switch (status) {
    case "unmodeled":
      return <Codicon name="circle-large-outline" label="Method not modeled" />;
    case "unsaved":
      return <Codicon name="pass" label="Changes have not been saved" />;
    case "saved":
      return <Codicon name="pass-filled" label="Method modeled" />;
    default:
      assertNever(status);
  }
}
