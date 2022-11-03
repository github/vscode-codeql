import { Repository } from '../../remote-queries/shared/repository';

export function matchesSearchValue(repo: Pick<Repository, 'fullName'>, searchValue: string | undefined): boolean {
  if (!searchValue) {
    return true;
  }

  return repo.fullName.toLowerCase().includes(searchValue.toLowerCase());
}
