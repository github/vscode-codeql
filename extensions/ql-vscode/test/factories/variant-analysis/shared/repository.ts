import { faker } from "@faker-js/faker";
import type {
  Repository,
  RepositoryWithMetadata,
} from "../../../../src/variant-analysis/shared/repository";

export function createMockRepository(): Repository {
  return {
    id: faker.number.int(),
    fullName: `github/${faker.word.sample()}`,
    private: faker.datatype.boolean(),
  };
}

export function createMockRepositoryWithMetadata(): RepositoryWithMetadata {
  return {
    ...createMockRepository(),
    stargazersCount: faker.number.int(),
    updatedAt: faker.date.past().toISOString(),
  };
}
