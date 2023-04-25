import * as React from "react";
import { useMemo } from "react";
import styled from "styled-components";

import { parseDate } from "../../pure/date";
import { humanizeRelativeTime } from "../../pure/time";

import { Codicon } from "./icon";

const IconContainer = styled.span`
  flex-grow: 0;
  text-align: right;
  margin-right: 0;
`;

const Duration = styled.span`
  display: inline-block;
  text-align: left;
  width: 8em;
  margin-left: 0.5em;
`;

type Props = {
  lastUpdated?: string | null;
};

export const LastUpdated = ({ lastUpdated }: Props) => {
  const date = useMemo(() => parseDate(lastUpdated), [lastUpdated]);

  if (!date) {
    return null;
  }

  return (
    <div>
      <IconContainer>
        <Codicon name="repo-push" label="Most recent commit" />
      </IconContainer>
      <Duration>{humanizeRelativeTime(date.getTime() - Date.now())}</Duration>
    </div>
  );
};
