import * as React from "react";
import { RepoPushIcon } from "@primer/octicons-react";
import styled from "styled-components";

import { humanizeRelativeTime } from "../../pure/time";

const IconContainer = styled.span`
  flex-grow: 0;
  text-align: right;
  margin-right: 0;
`;

const Duration = styled.span`
  text-align: left;
  width: 8em;
  margin-left: 0.5em;
`;

type Props = { lastUpdated?: number };

const LastUpdated = ({ lastUpdated }: Props) =>
  // lastUpdated will be undefined for older results that were
  // created before the lastUpdated field was added.
  Number.isFinite(lastUpdated) ? (
    <>
      <IconContainer>
        <RepoPushIcon size={16} />
      </IconContainer>
      <Duration>{humanizeRelativeTime(lastUpdated)}</Duration>
    </>
  ) : (
    <></>
  );

export default LastUpdated;
