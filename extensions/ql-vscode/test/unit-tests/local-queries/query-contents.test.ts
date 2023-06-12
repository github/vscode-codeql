import * as tmp from "tmp";
import { dump } from "js-yaml";
import { writeFileSync } from "fs-extra";
import { join } from "path";
import { QueryLanguage } from "../../../src/common/query-language";
import { getInitialQueryContents } from "../../../src/local-queries/query-contents";

describe("getInitialQueryContents", () => {
  let dir: tmp.DirResult;
  let language: QueryLanguage;

  beforeEach(() => {
    dir = tmp.dirSync();
    language = QueryLanguage.Cpp;

    const contents = dump({
      primaryLanguage: language,
    });
    writeFileSync(join(dir.name, "codeql-database.yml"), contents, "utf8");
  });

  afterEach(() => {
    dir.removeCallback();
  });

  it("should get initial query contents when language is known", () => {
    expect(getInitialQueryContents(language, "hucairz")).toBe(
      'import cpp\n\nselect ""',
    );
  });

  it("should get initial query contents when dbscheme is known", () => {
    expect(getInitialQueryContents("", "semmlecode.cpp.dbscheme")).toBe(
      'import cpp\n\nselect ""',
    );
  });

  it("should get initial query contents when nothing is known", () => {
    expect(getInitialQueryContents("", "hucairz")).toBe('select ""');
  });
});
