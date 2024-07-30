import { useCallback } from "react";
import { jumpToLocation } from "../result-table-utils";
import TextButton from "../../common/TextButton";
import { styled } from "styled-components";
import type { UrlValueResolvable } from "../../../common/raw-result-types";

interface Props {
  loc: UrlValueResolvable;
  label: string;
  databaseUri: string | undefined;
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
  onClick: onClick,
}: Props): React.JSX.Element {
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
