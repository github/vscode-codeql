import type { ReactNode } from "react";
import { styled } from "styled-components";

type Props = {
  title: ReactNode;
  children: ReactNode;
};

const Container = styled.div`
  flex: 1;
`;

const Header = styled.div`
  color: var(--vscode-editor-foreground);
  font-size: 0.85em;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 0.6em;
`;

export const StatItem = ({ title, children }: Props) => (
  <Container>
    <Header>{title}</Header>
    <div>{children}</div>
  </Container>
);
