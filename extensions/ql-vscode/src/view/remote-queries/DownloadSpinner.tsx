import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import styled from "styled-components";

const SpinnerContainer = styled.span`
  vertical-align: middle;
  display: inline-block;
`;

const DownloadSpinner = () => (
  <SpinnerContainer>
    <VSCodeProgressRing style={{ height: "0.8em", width: "0.8em" }} />
  </SpinnerContainer>
);

export default DownloadSpinner;
