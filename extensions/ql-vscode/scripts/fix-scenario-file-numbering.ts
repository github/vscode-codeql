/**
 * This scripts helps after recording a scenario to be used for replaying
 * with the mock GitHub API server.
 *
 * Once the scenario has been recorded, it's often useful to remove some of
 * the requests to speed up the replay, particularly ones that fetch the
 * variant analysis status. Once some of the requests have manually been
 * removed, this script can be used to update the numbering of the files.
 *
 * Usage: npx ts-node scripts/fix-scenario-file-numbering.ts <scenario-name>
 */

import * as fs from "fs-extra";
import * as path from "path";

if (process.argv.length !== 3) {
  console.error("Expected 1 argument - the scenario name");
}

const scenarioName = process.argv[2];

const extensionDirectory = path.resolve(__dirname, "..");
const scenariosDirectory = path.resolve(
  extensionDirectory,
  "src/mocks/scenarios",
);
const scenarioDirectory = path.resolve(scenariosDirectory, scenarioName);

async function fixScenarioFiles() {
  console.log(scenarioDirectory);
  if (!(await fs.pathExists(scenarioDirectory))) {
    console.error("Scenario directory does not exist: " + scenarioDirectory);
    return;
  }

  const files = await fs.readdir(scenarioDirectory);

  const orderedFiles = files.sort((a, b) => {
    const aNum = parseInt(a.split("-")[0]);
    const bNum = parseInt(b.split("-")[0]);
    return aNum - bNum;
  });

  let index = 0;
  for (const file of orderedFiles) {
    const ext = path.extname(file);
    if (ext === ".json") {
      const fileName = path.basename(file, ext);
      const fileCurrentIndex = parseInt(fileName.split("-")[0]);
      const fileNameWithoutIndex = fileName.split("-")[1];
      if (fileCurrentIndex !== index) {
        const newFileName = `${index}-${fileNameWithoutIndex}${ext}`;
        const oldFilePath = path.join(scenarioDirectory, file);
        const newFilePath = path.join(scenarioDirectory, newFileName);
        console.log(`Rename: ${oldFilePath} -> ${newFilePath}`);
        await fs.rename(oldFilePath, newFilePath);

        if (fileNameWithoutIndex === "getVariantAnalysisRepoResult") {
          const oldZipFileName = `${fileCurrentIndex}-getVariantAnalysisRepoResult.body.zip`;
          const newZipFileName = `${index}-getVariantAnalysisRepoResult.body.zip`;
          const oldZipFilePath = path.join(scenarioDirectory, oldZipFileName);
          const newZipFilePath = path.join(scenarioDirectory, newZipFileName);
          console.log(`Rename: ${oldZipFilePath} -> ${newZipFilePath}`);
          await fs.rename(oldZipFilePath, newZipFilePath);

          const json = await fs.readJson(newFilePath);
          json.response.body = `file:${newZipFileName}`;
          console.log(`Response.body change to ${json.response.body}`);
          await fs.writeJSON(newFilePath, json);
        }
      }

      index++;
    }
  }
}

fixScenarioFiles().catch((e) => {
  console.error(e);
  process.exit(2);
});
