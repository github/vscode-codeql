import * as fs from "fs-extra";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import * as unzipper from "unzipper";

export async function downloadDistribution(downloadUrl: string, distributionPath: string): Promise<void> {
  const downloadTmpDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-codeql"));
  const downloadFilePath = path.join(downloadTmpDirectory, "distributionDownload.zip");
  await downloadUrlToFile(downloadUrl, downloadFilePath);

  const archive = await unzipper.Open.file(downloadFilePath);
  await archive.extract({
    concurrency: 4,
    path: distributionPath
  }).promise();
}

function downloadUrlToFile(url: string, toPath: fs.PathLike): Promise<void> {
  const downloadFile = fs.createWriteStream(toPath);
  return new Promise((resolve, reject) =>
    https.get(url, response => {
      if (response.statusCode != 200) {
        downloadFile.end(() => reject(`Bad response status (status was ${response.statusCode})`));
        return;
      }

      response.pipe(downloadFile)
        .on("finish", resolve);
    })
      .on('error', err =>
        downloadFile.end(() => reject(`Request errored with message ${err.message}`))
    )
  );
}
