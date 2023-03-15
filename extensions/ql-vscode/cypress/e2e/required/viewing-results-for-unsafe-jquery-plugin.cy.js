/// <reference types="cypress" />

describe('CodeQL Extension', () => {
  before(() => {
    cy.visit('http://localhost:8080')
  })

  it('should run UnsafeJQueryPlugin.ql', () => {
    cy.get('.explorer-viewlet').type('{meta}{shift}p')

    cy.focused().type('Open Query')

    cy.findByText('Open Query').click()

    cy.findByText('UnsafeJQueryPlugin.ql').click()
  });
})

// it('Should trust project', () => {
//   cy.get('Yes, I trust the authors')
//   .find('div')
//   .should(($div) => {
//     if ($div.length !== 1) {
//       cy.contains('Yes, I trust the authors').click()
//     }
//   });
// })

// 1. Open the [UnsafeJQueryPlugin query](https://github.com/github/codeql/blob/main/javascript/ql/src/Security/CWE-079/UnsafeJQueryPlugin.ql).
// 2. Run a MRVA against the following repo list:

//    ```json
//    {
//       "name": "test-repo-list",
//       "repositories": [
//          "angular-cn/ng-nice",
//          "apache/hadoop",
//          "apache/hive"
//       ]
//    }
//    ```

// 3. Check that a notification message pops up and the results view is opened.
// 4. Check the query history. It should:
//    - Show that an item has been added to the query history
//    - The item should be marked as "in progress".
// 5. Once the query starts:
//    - Check the results view
//    - Check the code paths view, including the code paths drop down menu.
//    - Check that the repository filter box works
//    - Click links to files/locations on GitHub
//    - Check that the query history item is updated to show the number of results
// 6. Once the query completes:
//    - Check that the query history item is updated to show the query status as "complete"