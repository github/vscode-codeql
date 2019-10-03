Visual Studio Code Extension for QL
===

Based on [@alexet](https://git.semmle.com/alexet)'s branch.

Setup
---

Make sure you have a fairly recent of vscode (>1.32) are using nodejs
version >=v10.13.0. (Tested on v10.15.1 and v10.16.0).

To build the extension, you also need a checkout of the [`Semmle/code` repo](https://git.semmle.com/Semmle/code).
You can do one of the following:
- Checkout the `Semmle/code` repo to a directory named `code` in the root of the `Semmle/ql-vscode` checkout.
- Create a symlink named `code` in the root of the `Semmle/ql-vscode` checkout, pointing to your actual `Semmle/code` checkout.
- Set an environment variable to point to your `Semmle/code` checkout:
```shell
$ export SEMMLE_CODE=/your/path/to/semmle/code/checkout # for protobuf definitions
```

This repo uses [Rush](https://rushjs.io) to handle package management, building, and other
operations across multiple projects. See the Rush "[Getting started as a developer](https://rushjs.io/pages/developer/new_developer/)" docs
for more details.

If you plan on building from the command line, it's easiest if Rush is installed globally:

```shell
npm install -g @microsoft/rush
```

Note that when you run the `rush` command from the globally installed version, it will examine the
`rushVersion` property in the repo's `rush.json`, and if it differs from the globally installed
version, it will download, cache, and run the version of Rush specified in the `rushVersion`
property.

If you plan on only building via VS Code tasks, you don't need Rush installed at all, since those
tasks run `common/scripts/install-run-rush.js` to bootstrap a locally installed and cached copy of
Rush.

Building
---

### Installing all packages (instead of `npm install`)

After updating any `package.json` file, or after checking or pulling a new branch, you need to
make sure all the right npm packages are installed, which you would normally do via `npm install` in
a single-project repo. With Rush, you need to do an "update" instead:

#### From VS Code
`Terminal | Run Task... | Update`

#### From the command line
```shell
$ rush update
```

### Building all projects (instead of `gulp`)

Rush builds all projects in the repo, in dependency order, building multiple projects in parallel
where possible. By default, the build also packages the extension itself into a .vsix file in the
`dist` directory. To build:

#### From VS Code
`Terminal | Run Build Task...` (or just `Ctrl+Shift+B` with the default key bindings)

#### From the command line
```shell
$ rush build --verbose
```

### Forcing a clean build

Rush does a rasonable job of detecting which projects need to rebuilt on its own, but if you need to
force a full rebuild of all projects:

#### From VS Code
`Terminal | Run Task... | Rebuild`

#### From the command line
```shell
$ rush rebuild --verbose
```

### Installing

The `.vsix` file produced by the build can be installed with something like (depending on where you
have VSCode installed):

```shell
$ code --install-extension `pwd`/ql-vscode-0.0.1.vsix # normal VSCode installation
# or maybe
$ vscode/scripts/code-cli.sh --install-extension `pwd`/ql-vscode-0.0.1.vsix # if you're running from github checkout
```

Be sure to read the
[README.md](./extensions/ql-vscode/README.md) for the extension itself for information on necessary configuration, including setting the path to your Semmle Code distribution.

### Debugging

You can use VS Code to debug the extension without explicitly installing it. Just open this directory as a workspace in VS Code, and hit `F5` to start a debugging session. Be sure to read the
[README.md](./extensions/ql-vscode/README.md) for the extension itself for information on necessary configuration, including setting the path to your Semmle Code distribution.
