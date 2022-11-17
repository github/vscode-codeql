import { expect } from "chai";
import "mocha";
import * as path from "path";

import {
  DownloadLink,
  createDownloadPath,
} from "../../remote-queries/download-link";

describe("createDownloadPath", () => {
  it("should return the correct path", () => {
    const downloadLink: DownloadLink = {
      id: "abc",
      urlPath: "",
      innerFilePath: "",
      queryId: "def",
    };
    const expectedPath = path.join("storage", "def", "abc");

    const actualPath = createDownloadPath("storage", downloadLink);

    expect(actualPath).to.equal(expectedPath);
  });

  it("should return the correct path with extension", () => {
    const downloadLink: DownloadLink = {
      id: "abc",
      urlPath: "",
      innerFilePath: "",
      queryId: "def",
    };

    const expectedPath = path.join("storage", "def", "abc.zip");

    const actualPath = createDownloadPath("storage", downloadLink, "zip");

    expect(actualPath).to.equal(expectedPath);
  });
});
