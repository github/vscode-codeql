import { resolve } from "path";
import { deployPackage } from "./deploy";
import { spawn } from "child-process-promise";

export async function packageExtension(): Promise<void> {
  const deployedPackage = await deployPackage(
    resolve(__dirname, "../package.json"),
  );
  console.log(
    `Packaging extension '${deployedPackage.name}@${deployedPackage.version}'...`,
  );
  const args = [
    "package",
    "--out",
    resolve(
      deployedPackage.distPath,
      "..",
      `${deployedPackage.name}-${deployedPackage.version}.vsix`,
    ),
  ];
  const proc = spawn(
    resolve(__dirname, "../../../node_modules/.bin/vsce"),
    args,
    {
      cwd: deployedPackage.distPath,
    },
  );
  proc.childProcess.stdout!.on("data", (data) => {
    console.log(data.toString());
  });
  proc.childProcess.stderr!.on("data", (data) => {
    console.error(data.toString());
  });

  await proc;
}
