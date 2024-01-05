# VS Code version

The CodeQL for VS Code extension specifies the versions of VS Code that it is compatible with. VS Code will only offer to install and upgrade the extension when this version range is satisfied.

## Where is the VS Code version specified

1. Hard limit in [`package.json`](https://github.com/github/vscode-codeql/blob/606bfd7f877d9fffe4ff83b78015ab15f8840b12/extensions/ql-vscode/package.json#L16)

    This is the value that VS Code understands and respects. If a user does not meet this version requirement then VS Code will not offer to install the CodeQL for VS Code extension, and if the extension is already installed then it will silently refuse to upgrade the extension.

1. Soft limit in [`extension.ts`](https://github.com/github/vscode-codeql/blob/606bfd7f877d9fffe4ff83b78015ab15f8840b12/extensions/ql-vscode/src/extension.ts#L307)

    This value is used internally by the CodeQL for VS Code extension and is used to provide a warning to users without blocking them from installing or upgrading. If the extension detects that this version range is not met it will output a warning message to the user prompting them to upgrade their VS Code version to ge the latest features of CodeQL.

## When to update the VS Code version

Generally we should aim to support as wide a range of VS Code versions as we can, so unless there is a reason to do so we do not update the minimum VS Code version requirement.
Reasons for updating the minimum VS Code version include:

- A new feature is included in VS Code. We may want to ensure that it is available to use so we do not have to provide an alternative code path.
- A breaking change has happened in VS Code, and it is not possible to support both new and old versions.

Also consider what percentage of our users are using each VS Code version. This information is available in our telemetry.

## How to update the VS Code version

To provide a good experience to users, it is recommented to update the `MIN_VERSION` in `extension.ts` first and release, and then update the `vscode` version in `package.json` and release again.
By staggering this update across two releases it gives users on older VS Code versions a chance to upgrade before it silently refuses to upgrade them.

After updating the minimum version in `package.json`, make sure to also run the following command to update any generated
files dependent on this version:

```bash
npm run generate
```

## VS Code version used in tests

The integration tests use the latest stable version of VS Code. This is specified in
the [`test/vscode-tests/jest-runner-vscode.config.base.js`](https://github.com/github/vscode-codeql/blob/main/extensions/ql-vscode/test/vscode-tests/jest-runner-vscode.config.base.js#L15)
file. This shouldn't need to be updated unless there is a breaking change in VS Code that prevents the tests from running.
