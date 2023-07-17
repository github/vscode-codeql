import * as React from "react";
import { useCallback } from "react";
import { ResolvableLocationValue } from "../../../common/bqrs-cli-types";
import { jumpToLocation } from "../result-table-utils";

interface Props {
  loc: ResolvableLocationValue;
  label: string;
  databaseUri: string;
  title?: string;
  handleClick?: () => void;
}

/**
 * A clickable location link.
 */
export function ClickableLocation({
  loc,
  label,
  databaseUri,
  title,
  handleClick,
}: Props): JSX.Element {
  const jumpToLocationHandler = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      jumpToLocation(loc, databaseUri);
      handleClick?.();
    },
    [loc, databaseUri, handleClick],
  );

  return (
    <>
      {/*
          eslint-disable-next-line
          jsx-a11y/anchor-is-valid,
        */}
      <a
        href="#"
        className="vscode-codeql__result-table-location-link"
        title={title}
        onClick={jumpToLocationHandler}
      >
        {label}
      </a>
    </>
  );
}
