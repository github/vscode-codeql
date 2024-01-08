import type { ReactNode } from "react";
import { styled } from "styled-components";

type ContainerProps = {
  $type: "warning" | "error";
  $inverse?: boolean;
};

const getBackgroundColor = ({ $type, $inverse }: ContainerProps): string => {
  if (!$inverse) {
    return "var(--vscode-notifications-background)";
  }

  switch ($type) {
    case "warning":
      return "var(--vscode-editorWarning-foreground)";
    case "error":
      return "var(--vscode-debugExceptionWidget-border)";
  }
};

const getTextColor = ({ $type, $inverse }: ContainerProps): string => {
  if (!$inverse) {
    return "var(--vscode-editor-foreground)";
  }

  switch ($type) {
    case "warning":
      return "var(--vscode-editor-background)";
    case "error":
      return "var(--vscode-list-activeSelectionForeground)";
  }
};

const getBorderColor = ({ $type }: ContainerProps): string => {
  switch ($type) {
    case "warning":
      return "var(--vscode-editorWarning-foreground)";
    case "error":
      return "var(--vscode-editorError-foreground)";
  }
};

const getTypeText = (type: ContainerProps["$type"]): string => {
  switch (type) {
    case "warning":
      return "Warning";
    case "error":
      return "Error";
  }
};

const Container = styled.div<ContainerProps>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1em;
  padding: 1em;

  color: ${(props) => getTextColor(props)};
  background-color: ${(props) => getBackgroundColor(props)};
  border: 1px solid ${(props) => getBorderColor(props)};
`;

const Title = styled.div`
  font-size: 0.85em;
  font-weight: 800;
  text-transform: uppercase;
`;

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.75em;
  margin-left: auto;
`;

type Props = {
  type: "warning" | "error";
  title: string;
  message: ReactNode;

  actions?: ReactNode;

  // Inverse the color scheme
  inverse?: boolean;

  /**
   * Role is used as the ARIA role. "alert" should only be set if the alert requires
   * the user's immediate attention. "status" should be set if the alert is not
   * important enough to require the user's immediate attention.
   *
   * Can be left out if the alert is not important enough to require the user's
   * immediate attention. In this case, no ARIA role will be set and the alert
   * will be read as normal text. The user will not be notified about any changes
   * to the alert.
   */
  role?: "alert" | "status";
};

export const Alert = ({
  type,
  title,
  message,
  actions,
  inverse,
  role,
}: Props) => {
  return (
    <Container $type={type} $inverse={inverse} role={role}>
      <Title>
        {getTypeText(type)}: {title}
      </Title>
      <span>{message}</span>
      {actions && <ActionsContainer>{actions}</ActionsContainer>}
    </Container>
  );
};
