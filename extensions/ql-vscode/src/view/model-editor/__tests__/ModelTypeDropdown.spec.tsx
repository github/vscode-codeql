import { userEvent } from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { createNoneModeledMethod } from "../../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../../common/query-language";
import { ModelTypeDropdown } from "../ModelTypeDropdown";
import { createMethod } from "../../../../test/factories/model-editor/method-factories";

describe(ModelTypeDropdown.name, () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockReset();
  });

  it("allows changing the type", async () => {
    const method = createMethod();
    const modeledMethod = createNoneModeledMethod();

    render(
      <ModelTypeDropdown
        language={QueryLanguage.Java}
        modeledMethod={modeledMethod}
        modelPending={false}
        onChange={onChange}
        method={method}
        isCanary={false}
      />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "source");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "source",
      }),
    );
  });

  it("allows changing the type to 'Type' for Ruby in canary mode", async () => {
    const method = createMethod();
    const modeledMethod = createNoneModeledMethod();

    render(
      <ModelTypeDropdown
        language={QueryLanguage.Ruby}
        modeledMethod={modeledMethod}
        modelPending={false}
        onChange={onChange}
        method={method}
        isCanary={true}
      />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "type");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "type",
      }),
    );
  });

  it("does not allow changing the type to 'Type' for Ruby in non-canary mode", async () => {
    const method = createMethod();
    const modeledMethod = createNoneModeledMethod();

    render(
      <ModelTypeDropdown
        language={QueryLanguage.Ruby}
        modeledMethod={modeledMethod}
        modelPending={false}
        onChange={onChange}
        method={method}
        isCanary={false}
      />,
    );

    expect(
      screen.queryByRole("option", { name: "Type" }),
    ).not.toBeInTheDocument();
  });

  it("does not allow changing the type to 'Type' for Java", async () => {
    const method = createMethod();
    const modeledMethod = createNoneModeledMethod();

    render(
      <ModelTypeDropdown
        language={QueryLanguage.Java}
        modeledMethod={modeledMethod}
        modelPending={false}
        onChange={onChange}
        method={method}
        isCanary={false}
      />,
    );

    expect(
      screen.queryByRole("option", { name: "Type" }),
    ).not.toBeInTheDocument();
  });
});
