import { styled } from "styled-components";

type Props = {
  percent: number;
};

const Circle = styled.div`
  width: 16px;
  height: 16px;
`;

const Background = styled.circle`
  stroke: var(--vscode-editorWidget-background);
  fill: none;
  stroke-width: 2px;
`;

const Determinate = styled.circle`
  stroke: var(--vscode-progressBar-background);
  fill: none;
  stroke-width: 2px;
  stroke-linecap: round;
  transform-origin: 50% 50%;
  transform: rotate(-90deg);
  transition: all 0.2s ease-in-out 0s;
`;

const progressSegments = 44;

// This is a re-implementation of the FAST component progress ring
// See https://github.com/microsoft/fast/blob/21c210f2164c5cf285cade1a328460c67e4b97e6/packages/web-components/fast-foundation/src/progress-ring/progress-ring.template.ts
// Once the determinate progress ring is available in the VSCode webview UI toolkit, we should use that instead

export const DeterminateProgressRing = ({ percent }: Props) => (
  <Circle
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={percent}
  >
    <svg className="progress" viewBox="0 0 16 16" role="presentation">
      <Background cx="8px" cy="8px" r="7px" />
      <Determinate
        style={{
          strokeDasharray: `${
            (progressSegments * percent) / 100
          }px ${progressSegments}px`,
        }}
        cx="8px"
        cy="8px"
        r="7px"
      ></Determinate>
    </svg>
  </Circle>
);
