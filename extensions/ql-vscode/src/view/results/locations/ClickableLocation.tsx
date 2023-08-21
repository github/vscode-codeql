import * as React from "react";
import { useCallback } from "react";
import { ResolvableLocationValue } from "../../../common/bqrs-cli-types";
import { jumpToLocation } from "../result-table-utils";
import TextButton from "../../common/TextButton";
import { styled } from "styled-components";

interface Props {
  loc: ResolvableLocationValue;
  label: string;
  databaseUri: string;
  title?: string;
  onClick?: () => void;
}

const Link = styled(TextButton)`
  text-decoration: none;
`;

/**
 * A clickable location link.
 */
export function ClickableLocation({
  loc,
  label,
  databaseUri,
  title,
  onClick: onClick,
}: Props): JSX.Element {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      jumpToLocation(loc, databaseUri);
      onClick?.();
    },
    [loc, databaseUri, onClick],
  );

  return <Link onClick={handleClick}>{label}</Link>;
}
