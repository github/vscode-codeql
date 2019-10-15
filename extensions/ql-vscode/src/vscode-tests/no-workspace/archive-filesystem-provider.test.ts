import { expect } from "chai";
import * as path from "path";
import { Uri } from "vscode";
import { ArchiveFileSystemProvider, zipArchiveScheme } from "../../archive-filesystem-provider";

describe("archive filesystem provider", () => {
  it("reads empty file correctly", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const zipPath = path.join(__dirname, "data/archive-filesystem-provider-test/single_file.zip");
    const uri = Uri.file(zipPath).with({
      "scheme": zipArchiveScheme,
      "fragment": "aFileName.txt"
    });
    const data = await archiveProvider.readFile(uri);
    expect(data.length).to.equal(0);
  });
});
