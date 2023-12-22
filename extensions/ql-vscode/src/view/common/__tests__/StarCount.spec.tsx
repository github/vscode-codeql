import { render, screen } from "@testing-library/react";

import StarCount from "../StarCount";

describe(StarCount.name, () => {
  it("renders undefined stars correctly", () => {
    const { container } = render(<StarCount />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders NaN stars correctly", () => {
    const { container } = render(<StarCount starCount={NaN} />);

    expect(container).toBeEmptyDOMElement();
  });

  const testCases = [
    { starCount: 0, expected: "0" },
    { starCount: 1, expected: "1" },
    { starCount: 15, expected: "15" },
    { starCount: 578, expected: "578" },
    { starCount: 999, expected: "999" },
    { starCount: 1_000, expected: "1000" },
    { starCount: 1_001, expected: "1.0k" },
    { starCount: 5_789, expected: "5.8k" },
    { starCount: 9_999, expected: "10.0k" },
    { starCount: 10_000, expected: "10.0k" },
    { starCount: 10_001, expected: "10k" },
    { starCount: 73_543, expected: "74k" },
    { starCount: 155_783, expected: "156k" },
    { starCount: 999_999, expected: "1000k" },
    { starCount: 1_000_000, expected: "1000k" },
    { starCount: 1_000_001, expected: "1000k" },
  ];

  test.each(testCases)(
    "renders $starCount stars as $expected",
    ({ starCount, expected }) => {
      render(<StarCount starCount={starCount} />);

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );
});
