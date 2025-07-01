type NativeAddon = {
  getLongPathName(shortPath: string): string;
};

let addonInstance: NativeAddon;

function currentPlatform(): string | undefined {
  switch (process.platform) {
    case "win32":
      switch (process.arch) {
        case "x64":
          return "win32-x64-msvc";
      }
  }

  return undefined;
}

async function addon(): Promise<{
  getLongPathName(shortPath: string): string;
}> {
  if (addonInstance) {
    return addonInstance;
  }

  const addon = await import(`./platforms/${currentPlatform()}/index.node`);
  addonInstance = addon as NativeAddon;
  return addonInstance;
}

export async function getLongPathName(shortPath: string): Promise<string> {
  return (await addon()).getLongPathName(shortPath);
}
