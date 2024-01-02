import { render, screen } from "@testing-library/react";
import { ModelingStatusIndicator } from "../ModelingStatusIndicator";

describe(ModelingStatusIndicator.name, () => {
  test.each([
    {
      status: "unmodeled",
      text: "Method not modeled",
    },
    {
      status: "unsaved",
      text: "Changes have not been saved",
    },
    {
      status: "saved",
      text: "Method modeled",
    },
  ] as const)("renders %s status indicator", ({ status, text }) => {
    render(<ModelingStatusIndicator status={status} />);
    expect(screen.getByLabelText(text)).toBeVisible();
  });
});
