Vscode Extension for QL
===

Based on [@alexet](https://git.semmle.com/alexet)'s branch.

Building
---
To build `.vsix` extension from the commandline
```shell
$ npm install
$ export SEMMLE_CODE=/your/path/to/semmle/code/checkout
$ npm run compile
$ npm run package
```
which can be installed with something like
```shell
$ code --install-extension `pwd`/semmlestudiovscode-0.0.1.vsix
$ vscode/scripts/code-cli.sh --install-extension `pwd`/semmlestudiovscode-0.0.1.vsix # if you're running from github checkout
```

Otherwise, make sure you have
```
$ export SEMMLE_DIST=/your/path/to/semmle/distribution # for tools/odasa.jar, tools/ideserver.jar
```
set, and you can build and debug the extension from within vscode itself by opening this directory as a project
and hitting F5 to start a debugging session.

Using
---

### Interface

The contributed commands to the command palette (default `Ctrl+Shft+P`) are:

|Command|Comment|
|---|---|
|QL: Choose Database|Choose a database to work with|

The 'QL' view should exist on the left, below explorer, version
control, extensions, etc. icons. Within that panel you should
be able to see a list of databases.

### Configuring a Project

Suppose your working directory is called `~/js-queries`.
Then you can make a file `~/js-queries/.vscode/settings.json` with contents
```json
{
  "ql.projects": {
    ".": {
      "dbScheme": "jslib/semmlecode.javascript.dbscheme",
      "libraryPath": ["jslib"]
    }
  }
}
```
and copy `Semmle/code/ql/javascript/ql/src` to `~/js-queries/jslib`.
