export abstract class Localizer {
  protected abstract locales(): string | string[] | undefined;

  public localeCompare(
    a: string,
    b: string,
    options?: Intl.CollatorOptions,
  ): number {
    return a.localeCompare(b, this.locales(), options);
  }
}
