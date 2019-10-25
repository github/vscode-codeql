import { expect } from "chai";
import * as path from "path";
import { Uri } from "vscode";
import { ArchiveFileSystemProvider, zipArchiveScheme, decodeSourceArchiveUri, encodeSourceArchiveUri } from "../../archive-filesystem-provider";

describe("archive filesystem provider", () => {
  it("reads empty file correctly", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: path.resolve(__dirname, "data/archive-filesystem-provider-test/single_file.zip"),
      pathWithinSourceArchive: "/aFileName.txt"
    });
    const data = await archiveProvider.readFile(uri);
    expect(data.length).to.equal(0);
  });
});

describe('source archive uri encoding', function() {
  it('should work round trip with mixed case and unicode', function() {
    const ref = { sourceArchiveZipPath: "I-\u2665-codeql.zip", pathWithinSourceArchive: "/foo/bar" };
    const result = decodeSourceArchiveUri(encodeSourceArchiveUri(ref));
    expect(result.sourceArchiveZipPath).to.equal(ref.sourceArchiveZipPath);
    expect(result.pathWithinSourceArchive).to.equal(ref.pathWithinSourceArchive);
  });
});
