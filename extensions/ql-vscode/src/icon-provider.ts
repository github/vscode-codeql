import * as path from 'path';

// copied from databsaes-ui.ts
export type ThemableIconPath = { light: string; dark: string } | string;

export class IconProvider {
  constructor(private readonly extensionPath: string) { }

  // Used by databases-ui
  public getCheckIconPath(): ThemableIconPath {
    return {
      light: path.join(this.extensionPath, 'media/light/check.svg'),
      dark: path.join(this.extensionPath, 'media/dark/check.svg'),
    };
  }

  // Used by databases-ui
  public getRedCrossIconPath(): ThemableIconPath {
    return path.join(this.extensionPath, 'media/red-x.svg');
  }

  public getGitHubIconPath(): ThemableIconPath {
    return {
      light: path.join(this.extensionPath, 'media/light/github.svg'),
      dark: path.join(this.extensionPath, 'media/dark/github.svg'),
    };
  }

  public getCloudIconPath(): ThemableIconPath {
    return {
      light: path.join(this.extensionPath, 'media/light/cloud.svg'),
      dark: path.join(this.extensionPath, 'media/dark/cloud.svg'),
    };
  }
}
