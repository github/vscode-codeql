import { styled } from "styled-components";
import { LinkIconButton } from "../common/LinkIconButton";
import type { ModelPackDetails } from "../../common/model-pack-details";

const Container = styled.div`
  display: block;
`;

const Title = styled.h3`
  font-size: medium;
  font-weight: 500;
  margin: 0;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin-top: 5px;
`;

export const ModelPacks = ({
  modelPacks,
  openModelPackClick,
}: {
  modelPacks: ModelPackDetails[];
  openModelPackClick: (path: string) => void;
}): React.JSX.Element => {
  if (modelPacks.length <= 0) {
    return <></>;
  }

  return (
    <Container>
      <Title>Model packs</Title>
      <List>
        {modelPacks.map((modelPack) => (
          <li key={modelPack.path}>
            <LinkIconButton onClick={() => openModelPackClick(modelPack.path)}>
              <span slot="start" className="codicon codicon-file-code"></span>
              {modelPack.name}
            </LinkIconButton>
          </li>
        ))}
      </List>
    </Container>
  );
};
