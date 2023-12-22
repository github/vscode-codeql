import { Codicon } from "./Codicon";

type Props = {
  label?: string;
  className?: string;
};

export const LoadingIcon = ({ label = "Loading...", className }: Props) => (
  <Codicon
    name="loading"
    label={label}
    className={`${className ? `${className} ` : ""}codicon-modifier-spin`}
  />
);
