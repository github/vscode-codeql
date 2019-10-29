import { expect } from "chai";
import * as path from "path";
import { ArchiveFileSystemProvider, decodeSourceArchiveUri, encodeSourceArchiveUri, ZipFileReference } from "../../archive-filesystem-provider";

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

describe('source archive uri encoding', function () {
  const testCases: { name: string, input: ZipFileReference }[] = [
    {
      name: 'mixed case and unicode',
      input: { sourceArchiveZipPath: "/I-\u2665-codeql.zip", pathWithinSourceArchive: "/foo/bar" }
    },
    {
      name: 'Windows path',
      input: { sourceArchiveZipPath: "C:/Users/My Name/folder/src.zip", pathWithinSourceArchive: "/foo/bar.ext" }
    },
    {
      name: 'Unix path',
      input: { sourceArchiveZipPath: "/home/folder/src.zip", pathWithinSourceArchive: "/foo/bar.ext" }
    }
  ];
  for (const testCase of testCases) {
    it(`should work round trip with ${testCase.name}`, function () {
      const output = decodeSourceArchiveUri(encodeSourceArchiveUri(testCase.input));
      expect(output).to.eql(testCase.input);
    });
  }
});
