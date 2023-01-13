// Default to development build; use flag --release to indicate release build.
export const isDevBuild = !process.argv.includes("--release");
