import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import { ViewTitle } from "../common";

type Props = { viewState: ModelAlertsViewState };

export const ModelAlertsHeader = ({ viewState }: Props) => {
  return (
    <ViewTitle>
      Model evaluation results for {viewState.extensionPack.name}
    </ViewTitle>
  );
};
