import { faker } from "@faker-js/faker";
import {
  Repository,
  RepositoryWithMetadata,
} from "../../../../src/remote-queries/shared/repository";

export function createMockRepository(): Repository {
  return {
    id: faker.datatype.number(),
    fullName: `github/${faker.random.word()}`,
    private: faker.datatype.boolean(),
  };
}

export function createMockRepositoryWithMetadata(): RepositoryWithMetadata {
  return {
    ...createMockRepository(),
    stargazersCount: faker.datatype.number(),
    updatedAt: faker.date.past().toISOString(),
  };
}
