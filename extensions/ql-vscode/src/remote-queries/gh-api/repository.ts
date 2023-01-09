import * as t from "io-ts";

/**
 * Defines basic information about a repository.
 *
 * Different parts of the API may return different subsets of information
 * about a repository, but this model represents the very basic information
 * that will always be available.
 */
export const Repository = t.type({
  id: t.number,
  name: t.string,
  full_name: t.string,
  private: t.boolean,
});

export type Repository = t.TypeOf<typeof Repository>;

export const RepositoryWithMetadata = t.intersection([
  Repository,
  t.type({
    stargazers_count: t.number,
    updated_at: t.union([t.string, t.null]),
  }),
]);

export type RepositoryWithMetadata = t.TypeOf<typeof RepositoryWithMetadata>;
