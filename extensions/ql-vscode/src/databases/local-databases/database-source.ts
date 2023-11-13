interface DatabaseSourceFolder {
  type: "folder";
}

interface DatabaseSourceArchive {
  type: "archive";
  path: string;
}

interface DatabaseSourceGitHub {
  type: "github";
  repository: string;
  commitOid: string | null;
}

interface DatabaseSourceInternet {
  type: "url";
  url: string;
}

interface DatabaseSourceDebugger {
  type: "debugger";
}

export type DatabaseSource =
  | DatabaseSourceFolder
  | DatabaseSourceArchive
  | DatabaseSourceGitHub
  | DatabaseSourceInternet
  | DatabaseSourceDebugger;
