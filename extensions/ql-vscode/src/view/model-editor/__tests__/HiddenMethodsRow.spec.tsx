import { render, screen } from "@testing-library/react";
import { HiddenMethodsRow } from "../HiddenMethodsRow";

describe(HiddenMethodsRow.name, () => {
  it("does not render with 0 hidden methods", () => {
    const { container } = render(
      <HiddenMethodsRow numHiddenMethods={0} someMethodsAreVisible={true} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders with 1 hidden methods and no visible methods", () => {
    render(
      <HiddenMethodsRow numHiddenMethods={1} someMethodsAreVisible={false} />,
    );

    expect(
      screen.getByText("1 method modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 1 hidden methods and visible methods", () => {
    render(
      <HiddenMethodsRow numHiddenMethods={1} someMethodsAreVisible={true} />,
    );

    expect(
      screen.getByText("And 1 method modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 3 hidden methods and no visible methods", () => {
    render(
      <HiddenMethodsRow numHiddenMethods={3} someMethodsAreVisible={false} />,
    );

    expect(
      screen.getByText("3 methods modeled in other CodeQL packs"),
    ).toBeVisible();
  });

  it("renders with 3 hidden methods and visible methods", () => {
    render(
      <HiddenMethodsRow numHiddenMethods={3} someMethodsAreVisible={true} />,
    );

    expect(
      screen.getByText("And 3 methods modeled in other CodeQL packs"),
    ).toBeVisible();
  });
});
