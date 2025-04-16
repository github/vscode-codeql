import type { ChangeEvent } from "react";
import { styled } from "styled-components";
import { VscodeButton, VscodeTextfield } from "@vscode-elements/react-elements";
import { Codicon } from "../common";

export class Renaming {
  patternRegexp: RegExp | undefined;

  constructor(
    public pattern: string,
    public replacement: string,
  ) {
    this.patternRegexp = tryCompilePattern(pattern);
  }
}

function tryCompilePattern(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return undefined;
  }
}

const Input = styled(VscodeTextfield)`
  width: 20em;
`;

const Row = styled.div`
  display: flex;
  padding-bottom: 0.25em;
`;

const Details = styled.details`
  padding: 1em;
`;

interface RenamingInputProps {
  renamings: Renaming[];
  setRenamings: (renamings: Renaming[]) => void;
}

export function RenamingInput(props: RenamingInputProps) {
  const { renamings, setRenamings } = props;
  return (
    <Details>
      <summary>Predicate renaming</summary>
      <p>
        The following regexp replacements are applied to every predicate name on
        both sides. Predicates whose names clash after renaming are grouped
        together. Can be used to correlate predicates that were renamed between
        the two runs.
        <br />
        Can also be used to group related predicates, for example, renaming{" "}
        <code>.*ssa.*</code> to <code>SSA</code> will group all SSA-related
        predicates together.
      </p>
      {renamings.map((renaming, index) => (
        <Row key={index}>
          <Input
            value={renaming.pattern}
            placeholder="Pattern"
            onInput={(e: ChangeEvent<HTMLInputElement>) => {
              const newRenamings = [...renamings];
              newRenamings[index] = new Renaming(
                e.target.value,
                renaming.replacement,
              );
              setRenamings(newRenamings);
            }}
          >
            <Codicon name="search" slot="start" />
          </Input>
          <Input
            value={renaming.replacement}
            placeholder="Replacement"
            onInput={(e: ChangeEvent<HTMLInputElement>) => {
              const newRenamings = [...renamings];
              newRenamings[index] = new Renaming(
                renaming.pattern,
                e.target.value,
              );
              setRenamings(newRenamings);
            }}
          ></Input>
          <VscodeButton
            onClick={() =>
              setRenamings(renamings.filter((_, i) => i !== index))
            }
          >
            <Codicon name="trash" />
          </VscodeButton>
          <br />
        </Row>
      ))}
      <VscodeButton
        onClick={() => setRenamings([...renamings, new Renaming("", "")])}
      >
        Add renaming rule
      </VscodeButton>
    </Details>
  );
}
