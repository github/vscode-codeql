# Test Plan

This document describes the manual test plan for the QL extension for Visual Studio Code.

The plan will be executed manually to start with but the goal is to eventually automate parts of the process (based on 
effort vs value basis).

#### What this doesn't cover
We don't need to test features (and permutations of features) that are covered by automated tests.

### Before releasing the VS Code extension
- Go through the required test cases listed below
- Check major PRs since the previous release for specific one-off things to test. Based on that, you might want to 
choose to go through some of the Optional Test Cases.
- Run a query using the existing version of the extension (to generate an "old" query history item)

## Required Test Cases

### Pre-requisites

- Flip the `codeQL.canary` flag. This will enable MRVA in the extension.

### Test Case 1: MRVA - Running a problem path query and viewing results

1. Open the [UnsafeJQueryPlugin query](https://github.com/github/codeql/blob/main/javascript/ql/src/Security/CWE-079/UnsafeJQueryPlugin.ql).
2. Run a MRVA against the following repo list:
```
"test-repo-list": [
    "angular-cn/ng-nice",
    "apache/hadoop",
    "apache/hive"
]
```
3. Check that a notification message pops up and the results view is opened.
4. Check the query history. It should:
   - Show that an item has been added to the query history
   - The item should be marked as "in progress".
5. Once the query starts:
   - Check the results view 
   - Check the code paths view, including the code paths drop down menu. 
   - Check that the repository filter box works
   - Click links to files/locations on GitHub
   - Check that the query history item is updated to show the number of results
6. Once the query completes:
   - Check that the query history item is updated to show the query status as "complete"

### Test Case 2: MRVA - Running a problem query and viewing results

1. Open the [ReDoS query](https://github.com/github/codeql/blob/main/javascript/ql/src/Performance/ReDoS.ql).
2. Run a MRVA against the "Top 10" repositories.
3. Check the notification message. It should:
   - Show the number of repos that are going to be queried
   - Provide a link to the actions workflow
4. Check the query history. It should:
   - Show that an item has been added to the query history
   - The item should be marked as "in progress".
5. Once the query starts:
   - Check that a notification is shown with a link to the results view
   - Check that the results are rendered with an alert message and a highlighted code snippet:
![highlighted-code-snippet](images/highlighted-code-snippet.png)

### Test Case 3: MRVA - Running a non-problem query and viewing results

1. Open the [FunLinesOfCode query](https://github.com/github/codeql/blob/main/cpp/ql/src/Metrics/Functions/FunLinesOfCode.ql).
2. Run a MRVA against a single repository (e.g. `google/brotli`).
3. Once the query starts:
   - Open the query results
   - Check that the results show up in a table:
![results-table](images/results-table.png)

### Test Case 4: MRVA - Interacting with query history

1. Click a history item (for MRVA):
   - Check that exporting results works
   - Check that sorting results works
   - Check that copying repo lists works 
2. Open the query directory (containing results):
   - Check that the correct directory is opened and there are results in it
3. Open variant analysis on GitHub
   - Check that the correct workflow is opened

### Test Case 5: MRVA - Canceling a variant analysis run

Run one of the above MRVAs, but cancel it from within VS Code:
- Check that the query is cancelled and the query history item is updated.
- Check that the workflow run is also cancelled. 
- Check that any available results are visible in VS Code.

### Test Case 6: MRVA - Change to a different colour theme 

Open one of the above MRVAs, try changing to a different colour theme and check that everything looks sensible. 
Are there any components that are not showing up?

## Optional Test Cases

These are mostly aimed at MRVA, but some of them are also applicable to non-MRVA queries.

### Selecting repositories to run on

#### Test case 1: Running a query on a single repository
1. When the repository exists and is public 
   1. Has a CodeQL database for the correct language 
   2. Has a CodeQL database for another language 
   3. Does not have any CodeQL databases
2. When the repository exists and is private
   1. Is accessible and has a CodeQL database
   2. Is not accessible
3. When the repository does not exist

#### Test case 2: Running a query on a custom repository list
1. The repository list is non-empty
   1. All repositories in the list have a CodeQL database 
   2. Some but not all repositories in the list have a CodeQL database
   3. No repositories in the list have a CodeQL database
2. The repository list is empty

#### Test case 3: Running a query on all repositories in an organization
1. The org exists 
   1. The org contains repositories that have CodeQL databases
   2. The org contains repositories of the right language but without CodeQL databases
   3. The org contains repositories not of the right language
   4. The org contains private repositories that are inaccessible
2. The org does not exist

### Using different types of controller repos

#### Test case 1: Running a query when the controller repository is public
1. Can run queries on public repositories
2. Can not run queries on private repositories

#### Test case 2: Running a query when the controller repository is private
1. Can run queries on public repositories
2. Can run queries on private repositories

#### Test case 3: Running a query when the controller repo exists but you do not have write access
1. Cannot run queries

#### Test case 4: Running a query when the controller repo doesn’t exist
1. Cannot run queries

#### Test case 5: Running a query when the "config field" for the controller repo is not set
1. Cannot run queries

### Query History

This requires running a MRVA query and viewing the query history.

The first test case specifies actions that you can do when the query is first run and is in "pending" state. We start
with this since it has quite a limited number of actions you can do.

#### Test case 1: When variant analysis state is "pending"
1. Starts monitoring variant analysis
2. Cannot open query history item
3. Can delete a query history item
   1. Item is removed from list in UI
   2. Files on dist are deleted (can get to files using "open query directory")
4. Can sort query history items
   1. By name
   2. By query date
   3. By result count
5. Cannot open query directory
6. Can open query that produced these results 
   1. When the file still exists and has not moved 
   2. When the file does not exist
7. Cannot open variant analysis on github
8. Cannot copy repository list
9. Cannot export results
10. Cannot select to create a gist
11. Cannot select to save as markdown
12. Cannot cancel analysis

#### Test case 2: When the variant analysis state is not "pending"
1. Query history is loaded when VSCode starts
2. Handles when action workflow was cancelled while VSCode was closed
3. Can open query history item
    1. Manually by clicking on them
    2. Automatically when VSCode starts (if they were open when VSCode was last used)
4. Can delete a query history item
    1. Item is removed from list in UI
    2. Files on dist are deleted (can get to files using "open query directory")
5. Can sort query history items
    1. By name
    2. By query date
    3. By result count
6. Can open query directory
7. Can open query that produced these results
    1. When the file still exists and has not moved
    2. When the file does not exist
8. Can open variant analysis on github
9. Can copy repository list
   1. Text is copied to clipboard
   2. Text is a valid repository list
10. Can export results
11. Can select to create gist
    1. A gist is created
    2. The first thing in the gist is a summary
    3. Contains a file for each repository with results
    4. A popup links you to the gist
12. Can select to save as markdown
    1. A directory is created on disk
    2. Contains a summary file
    3. Contains a file for each repository with results
    4. A popup allows you to open the directory

#### Test case 3: When variant analysis state is "in_progress"
1. Starts monitoring variant analysis
   1. Ready results are downloaded 
2. Can cancel analysis 
   1. Causes the actions run to be cancelled

#### Test case 4: When variant analysis state is in final state ("succeeded"/"failed"/"canceled")
1. Stops monitoring variant analysis
   1. All results are downloaded if state is succeeded
   2. Otherwise, ready results are downloaded, if any are available
2. Cannot cancel analysis

### Results view

This requires running a MRVA query and seeing the results view.

#### Test case 1: When variant analysis state is "pending"
1. Can open a results view
2. Results view opens automatically
   - When starting variant analysis run
   - When VSCode opens (if view was open when VSCode was closed)
3. Results view is empty

#### Test case 2: When variant analysis state is not "pending"
1. Can open a results view
2. Results view opens automatically
   1. When starting variant analysis run 
   2. When VSCode opens (if view was open when VSCode was closed)
3. Can copy repository list
   1. Text is copied to clipboard
   2. Text is a valid repository list
4. Can export results
   1. Only includes repos that you have selected (also see section from query history)
5. Can cancel analysis
6. Can open query file
   1. When the file still exists and has not moved
   2. When the file does not exist
7. Can open query text 
8. Can sort repos 
   1. By name 
   2. By results 
   3. By stars 
   4. By last commit
9. Can filter repos
10. Shows correct statistics 
    1. Total number of results 
    2. Total number of repositories 
    3. Duration
11. Can see live results 
    1. Results appear in extension as soon as each query is completed
12. Can view interpreted results (i.e. for a "problem" query)
    1. Can view non-path results 
    2. Can view code paths for "path-problem" queries
13. Can view raw results (i.e. for a non "problem" query)
    1. Renders a table
14. Can see skipped repositories 
    1. Can see repos with no db in a tab 
       1. Shown warning that explains the tab 
    2. Can see repos with no access in a tab
       1. Shown warning that explains the tab 
    3. Only shows tab when there are skipped repos
15. Result downloads 
    1. All results are downloaded automatically 
    2. Download status is indicated by a spinner (Not currently any indication of progress beyond "downloading" and "not downloading")
    3. Only 3 items are downloaded at a time 
    4. Results for completed queries are still downloaded when 
       1. Some but not all queries failed 
       2. The variant analysis was cancelled after some queries completed

#### Test case 3: When variant analysis state is in "succeeded" state
1. Can view logs
2. All results are downloaded 

#### Test case 4: When variant analysis is in "failed" or "cancelled" state
1. Can view logs
1. Results for finished queries are still downloaded.

### Is all copy / text correct?
1. In prompts when running a query
2. In query history
3. In results view
