import { faker } from "@faker-js/faker";
import {
  Repository,
  RepositoryWithMetadata,
} from "../../../../src/variant-analysis/gh-api/repository";

export function createMockRepository(name = faker.random.word()): Repository {
  return {
    id: faker.datatype.number(),
    name,
    full_name: `github/${name}`,
    private: faker.datatype.boolean(),
  };
}

export function createMockRepositoryWithMetadata(): RepositoryWithMetadata {
  return {
    ...createMockRepository(),
    stargazers_count: faker.datatype.number(),
    updated_at: faker.date.past().toISOString(),
  };
}
