import { useCallback } from "react";
import { styled } from "styled-components";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import { Codicon } from "./icon";

const TextField = styled(VscodeTextfield)`
  width: 100%;
`;

type Props = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;

  className?: string;
};

export const SearchBox = ({
  value,
  placeholder,
  onChange,
  className,
}: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLInputElement;

      onChange(target.value);
    },
    [onChange],
  );

  return (
    <TextField
      placeholder={placeholder}
      value={value}
      onInput={handleInput}
      className={className}
    >
      <Codicon name="search" label="Search..." slot="start" />
    </TextField>
  );
};
