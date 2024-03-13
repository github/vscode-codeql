interface DatabaseOriginFolder {
  type: "folder";
}

interface DatabaseOriginArchive {
  type: "archive";
  path: string;
}

interface DatabaseOriginGitHub {
  type: "github";
  repository: string;
  databaseId: number;
  databaseCreatedAt: string;
  commitOid: string | null;
}

interface DatabaseOriginInternet {
  type: "url";
  url: string;
}

interface DatabaseOriginDebugger {
  type: "debugger";
}

interface DatabaseOriginTestProj {
  type: "testproj";
  path: string;
}

export type DatabaseOrigin =
  | DatabaseOriginFolder
  | DatabaseOriginArchive
  | DatabaseOriginGitHub
  | DatabaseOriginInternet
  | DatabaseOriginDebugger
  | DatabaseOriginTestProj;
