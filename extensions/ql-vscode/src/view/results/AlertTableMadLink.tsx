import * as React from "react";
import { styled } from "styled-components";
import { MadFileLocation } from "../../common/interface-types";
import TextButton from "../common/TextButton";
import { openFileLocation } from "./result-table-utils";
import { useCallback } from "react";

const Link = styled(TextButton)`
  text-decoration: none;
`;

interface Props {
  madLocation: MadFileLocation;
}

export function AlertTableMadLink(props: Props) {
  const { madLocation } = props;
  const handleMadClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!madLocation) {
        return;
      }
      openFileLocation(madLocation);
    },
    [madLocation],
  );

  return (
    <td>
      <Link onClick={handleMadClick}>
        {nameFromExtensible(madLocation.extensible)}
      </Link>
    </td>
  );
}

function nameFromExtensible(extensible: string) {
  switch (extensible) {
    case "sourceModel":
      return "SOURCE";
    case "sinkModel":
      return "SINK";
    case "summaryModel":
      return "FLOW";
    default:
      return "UNKNOWN";
  }
}
