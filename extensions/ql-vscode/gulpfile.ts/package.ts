import { resolve } from "path";
import { deployPackage } from "./deploy";
import { spawn } from "cross-spawn";

export async function packageExtension(): Promise<void> {
  const deployedPackage = await deployPackage();
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
    "--no-dependencies",
    "--skip-license",
  ];
  const proc = spawn(resolve(__dirname, "../node_modules/.bin/vsce"), args, {
    cwd: deployedPackage.distPath,
    stdio: ["ignore", "inherit", "inherit"],
  });

  await new Promise((resolve, reject) => {
    proc.on("error", reject);

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Failed to package extension with code ${code}`));
      }
    });
  });
}
