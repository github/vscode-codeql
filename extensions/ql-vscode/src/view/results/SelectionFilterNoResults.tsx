import { styled } from "styled-components";
import { SourceArchiveRelationship } from "../../common/interface-types";

interface Props {
  sourceArchiveRelationship: SourceArchiveRelationship;
}

const Root = styled.div`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Container = styled.span`
  max-width: 80%;
  font-size: 14px;
  text-align: center;
`;

export function SelectionFilterNoResults({
  sourceArchiveRelationship,
}: Props): React.JSX.Element {
  return (
    <Root>
      <Container>
        No results match the current selection filter.
        {sourceArchiveRelationship ===
          SourceArchiveRelationship.NotInArchive && (
          <>
            <br />
            This file is not part of a source archive for a database.
          </>
        )}
        {sourceArchiveRelationship ===
          SourceArchiveRelationship.WrongArchive && (
          <>
            <br />
            This file is part of the source archive for a different database
            than the one this query was run on.
          </>
        )}
      </Container>
    </Root>
  );
}
