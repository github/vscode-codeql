import { faker } from "@faker-js/faker";
import type {
  Repository,
  RepositoryWithMetadata,
} from "../../../../src/variant-analysis/gh-api/repository";

export function createMockRepository(name = faker.word.sample()): Repository {
  return {
    id: faker.number.int(),
    name,
    full_name: `github/${name}`,
    private: faker.datatype.boolean(),
  };
}

export function createMockRepositoryWithMetadata(): RepositoryWithMetadata {
  return {
    ...createMockRepository(),
    stargazers_count: faker.number.int(),
    updated_at: faker.date.past().toISOString(),
  };
}
