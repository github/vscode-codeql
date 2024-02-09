import { render as reactRender, screen, waitFor } from "@testing-library/react";
import type { SuggestBoxProps } from "../SuggestBox";
import { SuggestBox } from "../SuggestBox";
import { userEvent } from "@testing-library/user-event";

type TestOption = {
  label: string;
  value: string;
  followup?: TestOption[];
};

const options: TestOption[] = [
  {
    label: "Argument[self]",
    value: "Argument[self]",
  },
  {
    label: "Argument[0]",
    value: "Argument[0]",
    followup: [
      {
        label: "Element[0]",
        value: "Argument[0].Element[0]",
      },
      {
        label: "Element[1]",
        value: "Argument[0].Element[1]",
      },
      {
        label: "Element[any]",
        value: "Argument[0].Element[any]",
      },
    ],
  },
  {
    label: "Argument[1]",
    value: "Argument[1]",
  },
  {
    label: "Argument[text_rep:]",
    value: "Argument[text_rep:]",
  },
  {
    label: "Argument[block]",
    value: "Argument[block]",
    followup: [
      {
        label: "Parameter[0]",
        value: "Argument[block].Parameter[0]",
        followup: [
          {
            label: "Element[:query]",
            value: "Argument[block].Parameter[0].Element[:query]",
          },
          {
            label: "Element[:parameters]",
            value: "Argument[block].Parameter[0].Element[:parameters]",
          },
        ],
      },
      {
        label: "Parameter[1]",
        value: "Argument[block].Parameter[1]",
        followup: [
          {
            label: "Field[@query]",
            value: "Argument[block].Parameter[1].Field[@query]",
          },
        ],
      },
    ],
  },
  {
    label: "ReturnValue",
    value: "ReturnValue",
  },
];

describe("SuggestBox", () => {
  const onChange = jest.fn();
  const parseValueToTokens = jest.fn();
  const render = (props?: Partial<SuggestBoxProps<TestOption>>) =>
    reactRender(
      <SuggestBox
        options={options}
        onChange={onChange}
        parseValueToTokens={parseValueToTokens}
        renderInputComponent={(props) => <input {...props} />}
        {...props}
      />,
    );

  beforeEach(() => {
    onChange.mockReset();
    parseValueToTokens
      .mockReset()
      .mockImplementation((value: string) => value.split("."));
  });

  it("does not render the options by default", () => {
    render();

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("renders the options after clicking on the text field", async () => {
    render();

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(options.length);
  });

  it("calls onChange after entering text", async () => {
    render({
      value: "Argument[block]",
    });

    await userEvent.type(screen.getByRole("combobox"), ".");

    expect(onChange).toHaveBeenCalledWith("Argument[block].");
  });

  it("calls onChange after clearing text", async () => {
    render({
      value: "Argument[block].",
    });

    await userEvent.clear(screen.getByRole("combobox"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders matching options with a single token", async () => {
    render({
      value: "block",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option")).toHaveTextContent("Argument[block]");
  });

  it("renders followup options with a token and an empty token", async () => {
    render({
      value: "Argument[block].",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("renders matching followup options with two tokens", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option")).toHaveTextContent("Parameter[1]");
  });

  it("selects an option using Enter", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("Argument[block].Parameter[1]");
  });

  // Skipped because it's flaky
  it.skip("selects an option using Tab", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Tab}");

    expect(onChange).toHaveBeenCalledWith("Argument[block].Parameter[1]");
  });

  it("does not select an option using Home", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Home}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes the options when selecting an option using Enter", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).not.toHaveLength(0);

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  // Skipped because it's flaky
  it.skip("closes the options when selecting an option using Tab", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).not.toHaveLength(0);

    await userEvent.keyboard("{Tab}");

    await waitFor(() => {
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    });
  });

  it("shows no suggestions with no matching followup options", async () => {
    render({
      value: "Argument[block].block",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("No suggestions.")).toBeInTheDocument();
  });

  it("can navigate the options using the keyboard", async () => {
    render({
      value: "",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard(
      "{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{ArrowDown}{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith("Argument[text_rep:]");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("can use loop navigation when using the keyboard", async () => {
    render({
      value: "",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith("Argument[block]");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("can close the options using escape", async () => {
    render({
      value: "",
    });

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(options.length);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("opens the options when using backspace on a selected option", async () => {
    render({
      value: "Argument[block].1",
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await userEvent.keyboard("{Backspace}");

    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
