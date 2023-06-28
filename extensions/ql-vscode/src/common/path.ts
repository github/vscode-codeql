// Returns the basename of a path. Trailing directory separators are ignored.
// Works for both POSIX and Windows paths.
export const basename = (path: string): string => {
  // If the path contains a forward slash, that means it's a POSIX path. Windows does not allow
  // forward slashes in file names.
  if (path.includes("/")) {
    // Trim trailing slashes
    path = path.replace(/\/+$/, "");

    const index = path.lastIndexOf("/");
    return index === -1 ? path : path.slice(index + 1);
  }

  // Otherwise, it's a Windows path. We can use the backslash as a separator.

  // Trim trailing slashes
  path = path.replace(/\\+$/, "");

  const index = path.lastIndexOf("\\");
  return index === -1 ? path : path.slice(index + 1);
};

// Returns the extension of a path, including the leading dot.
export const extname = (path: string): string => {
  const name = basename(path);

  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index);
};
