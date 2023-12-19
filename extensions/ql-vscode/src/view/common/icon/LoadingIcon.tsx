import * as React from "react";
import { Codicon } from "./Codicon";
import * as classNames from "classnames";

type Props = {
  label?: string;
  className?: string;
};

export const LoadingIcon = ({ label = "Loading...", className }: Props) => (
  <Codicon
    name="loading"
    label={label}
    className={classNames(className, "codicon-modifier-spin")}
  />
);
