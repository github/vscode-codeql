VSCode Extension for QL
===

Based on [@alexet](https://git.semmle.com/alexet)'s branch.

Building
---
To build `.vsix` extension from the commandline

```shell
$ npm install
$ npm run gulp
```

which can then be installed with something like (depending on where you have VSCode installed)

```shell
$ code --install-extension `pwd`/semmlestudiovscode-0.0.1.vsix # normal VSCode installation
# or maybe
$ vscode/scripts/code-cli.sh --install-extension `pwd`/semmlestudiovscode-0.0.1.vsix # if you're running from github checkout
```

Otherwise, you can build and debug the extension from within VSCode itself by opening this directory as a project
and hitting `F5` to start a debugging session. You may need to set an environment variable:

```
$ export SEMMLE_CODE=/your/path/to/semmle/code/checkout # for protobuf definitions
$ export SEMMLE_DIST=/your/path/to/semmle/distribution # for tools/odasa.jar, tools/ideserver.jar
```

You can download the release `Semmle Core (odasa)` from the corporate [release downloads webpage](https://wiki.semmle.com/display/REL/QL+tools+downloads).

Using
---

### Interface

The contributed commands to the command palette (default `Ctrl+Shift+P`) are:

|Command|Comment|
|---|---|
|QL: Choose Database|Choose a database to work with|

A valid database in the context of this QL plugin is a directory containing the database folder.
Here is an example of a directory produced as a revision using `odasa bootstrap` command:

```
revision-2019-June-28--10-38-01
├── external
│   ├── data
│   ├── defects
│   ├── metrics
│   └── trap
├── log
├── output
│   ├── extra-data
│   └── results
│       └── semmlecode-python-queries
└── working
    ├── db-python
    │   └── default
    └── trap
        └── externalArtifacts
```

In the context of QL for VSCode plugin, the `working` directory would be the database folder 
that you would have to browse to.

The `QL` view should exist on the left, below explorer, version control, extensions, etc. icons. 
Within that panel you should be able to see a list of databases.

### Configuring a Project

* Add `"ql.distributionPath": "/path/to/odasa/release/distribution"` property to the
VSCode preferences.

* Create project configuration file. Suppose your working directory is called `~/js-queries`.
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
and copy contents of the `Semmle/code/ql/javascript/ql/src` to `~/js-queries/jslib`.
