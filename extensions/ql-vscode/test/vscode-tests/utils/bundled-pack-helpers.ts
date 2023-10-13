import { Readable } from "stream";
import { extract as tar_extract, Headers } from "tar-stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import * as fs from "fs/promises";

export interface QueryPackFS {
  fileExists: (name: string) => boolean;
  fileContents: (name: string) => Buffer;
  directoryContents: (name: string) => string[];
  allFiles: () => string[];
}

let bufferIndex = 0;

export async function readBundledPack(
  base64Pack: string,
): Promise<QueryPackFS> {
  const fileName = `pack-${bufferIndex}.tar.gz`;
  await fs.writeFile(fileName, Buffer.from(base64Pack, "base64"));
  bufferIndex++;

  const buffer = Buffer.from(base64Pack, "base64");
  const stream = Readable.from(buffer);

  const extract = tar_extract();

  const files: Record<
    string,
    {
      headers: Headers;
      contents: Buffer;
    }
  > = {};

  let entryCount = 0;
  extract.on("entry", function (headers: Headers, stream, next) {
    const buffers: Buffer[] = [];

    entryCount++;

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => {
      files[headers.name] = {
        headers,
        contents: Buffer.concat(buffers),
      };

      next();
    });
    stream.on("error", (err) => {
      console.error(err);
      next();
    });
  });

  await pipeline(stream, createGunzip(), extract);

  expect(`${entryCount} ${bufferIndex - 1}`).not.toEqual(
    `0 ${bufferIndex - 1}`,
  );

  const directories: Record<string, number> = {};
  for (let file of Object.keys(files)) {
    while (file.indexOf("/") > 0) {
      const directory = file.substring(0, file.lastIndexOf("/"));
      if (!(directory in directories)) {
        directories[directory] = 0;
      }

      directories[directory]++;

      file = directory;
    }
  }

  return {
    fileExists: (name: string) => {
      return files[name]?.headers.type === "file";
    },
    fileContents: (name: string): Buffer => {
      const file = files[name];
      if (file?.headers.type === "file") {
        return file.contents;
      }

      throw new Error(`File ${name} does not exist`);
    },
    directoryContents: (name: string): string[] => {
      return Object.keys(directories)
        .filter(
          (dir) =>
            dir.startsWith(name) &&
            dir !== name &&
            dir.substring(name.length + 1).split("/").length === 1,
        )
        .map((dir) => dir.substring(name.length + 1));
    },
    allFiles: (): string[] => {
      return Object.keys(files);
    },
  };
}
