import React, { useEffect } from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import { RemoteQueries } from "../../view/remote-queries/RemoteQueries";

import remoteQueryResult from "./data/remoteQueryResultMessage.json";
import analysesResults from "./data/analysesResultsMessage.json";

export default {
  title: "MRVA/Remote Queries",
  component: RemoteQueries,
} as ComponentMeta<typeof RemoteQueries>;

const Template: ComponentStory<typeof RemoteQueries> = () => {
  useEffect(() => {
    window.postMessage(remoteQueryResult);
    window.postMessage(analysesResults);
  });

  return <RemoteQueries />;
};

export const Top10JavaScript = Template.bind({});
