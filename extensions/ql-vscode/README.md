Visual Studio Code Extension for QL
===

Configuration
---

To edit the configuration settings, right-click **QL** in the Extensions container in the sidebar and select `Configure Extension Settings`. You can also directly create and edit a `settings.json` file. (See below for more instructions.)

### Getting a CodeQL distribution

<font color="red">TODO: Remove the references to internal tools in the following sections before release.</font>

#### Recommended for internal users: Download distribution from internal Jenkins

For IntelliSense and query evaluation to work, set `ql.distribution.codeQlPath` to point to a CodeQL binary.

You can download a CodeQL binary from [Jenkins](https://jenkins.internal.semmle.com/job/CodeQL-CLI/) (open the last successful artifacts and download `codeql-all.zip`).  Upon extracting the archive, the CodeQL binary path will be `extractionRoot/codeql/codeql` where `extractionRoot` is the folder in which you extracted the zip.

To build your own CodeQL binary, you must use a Semmle Core distribution from recent `master`, i.e. built after 15 October 2019 and containing [this commit](http://git.semmle.com/Semmle/code/commit/a23097f89db42578a3f8d88558033dda16334290). Then run `./build target/intree/codeql`.  The CodeQL binary path will be `codeRoot/target/intree/codeql/codeql`, where `codeRoot` is the root of your `Semmle/code` checkout.

This setting can be set per-workspace, or you can set it in your global user settings to apply to all workspaces you open.

#### Using a `codeql` binary on your PATH

If you already have a `codeql` binary on your path, the extension will use this binary.

#### Using an extension-managed distribution

We envision many end-users electing to have the extension manage its distribution of CodeQL. When the extension is publicly released, this will require no configuration, however before then you will need to add the following configuration to `.vscode/settings.json` or another vscode settings file:

```json
"ql.distribution.includePrerelease": true,
"ql.distribution.personalAccessToken": "SUBSTITUTE THIS WITH YOUR PERSONAL ACCESS TOKEN",
"ql.distribution.owner": "github",
"ql.distribution.repository": "codeql-cli-binaries",
```

A personal access token is required to authenticate to the [private binaries repository](https://github.com/github/codeql-cli-binaries). To obtain one, follow the instructions [here](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) and [here](https://help.github.com/en/github/authenticating-to-github/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on). The token must be assigned the [`repo`](https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/) scope to have access to the releases of this repository.

You can use the "QL: Install/Update Tools" command to update the extension-managed distribution.

### Configuring a QL project

You need to set up `qlpack.json` files inside each ql pack (https://github.com/Semmle/ql/pull/2119/files added them for the main repository). All ql dependencies currently need to be in an open workspace folder.

To make the standard libraries available in your workspace, click File > Add Folder to Workspace, and choose your local checkout of the `Semmle/ql` repository.

To make your custom QL project depend on a standard library (e.g. for C++), create a `qlpack.json` file with the following contents:
{
    "name": "my-custom-cpp-pack",
    "version": "0.0.0",
    "libraryPathDependencies": ["codeql-cpp"]
}

Using the extension
---

You can find all contributed commands in the Command Palette (default `Ctrl+Shift+P`) by typing "QL", but you can also access some of them through the interface.

### Adding a QL database

1. Obtain a database, for example from LGTM.com and unzip it. (In future, you'll be able to add the `.zip` file directly.)
2. In the sidebar, go to `QL > Databases` and click "+".
3. Browse to the database folder (the parent folder of `db-<language>` and `src`) and add it.

It will now appear in the sidebar under `Databases`. If you have multiple databases, you can select which should be the current one.

### Running a query

1. Open an existing query from one of your QL projects, or save a new one in the project folder.
2. Make sure that the `.ql` file is in focus.
3. Open the Command Palette (default `Ctrl+Shift+P`) and type "Run Query".

You can see the progress of the query run in the bottom right corner.
Once it has finished, the results are displayed in the QL Query Results view.
In the sidebar, under `Query History`, you can see the queries that you have run in the current session.
