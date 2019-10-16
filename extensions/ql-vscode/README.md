Visual Studio Code Extension for QL
===

Configuration
---

To edit the configuration settings, right-click **QL** in the Extensions container in the sidebar and select `Configure Extension Settings`. You can also directly create and edit a `settings.json` file. (See below for more instructions.)

### Setting the path to Semmle Core

<font color="red">TODO: Remove the following reference to internal jenkins before release:</font>
For IntelliSense and query evaluation to work, set `ql.distributionPath` to point to a Semmle Core distribution.

You must use a Semmle Core distribution from recent `master`, i.e. built after 15 October 2019 and containing [this commit](http://git.semmle.com/Semmle/code/commit/a23097f89db42578a3f8d88558033dda16334290). This can be built from a `Semmle/code` checkout or downloaded from `master` builds of [the ODASA job on Jenkins](https://jenkins.internal.semmle.com/job/ODASA/).

If you have built your own distribution from a `Semmle/code` checkout, this path will be something like `codeRoot/target/intree/standard`, where `codeRoot` is the root of your `Semmle/code` checkout. If you have downloaded the distribution, this might be something like `/home/$USER/odasa`.

This setting can be set per-workspace, or you can set it in your
global user settings to apply to all workspaces you open.

### Configuring a QL project

You need to set up `qlpack.json` files inside each ql pack (https://github.com/Semmle/ql/pull/2119/files will add them for the main repository). All ql dependencies currently need to be in an open workspace folder.

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