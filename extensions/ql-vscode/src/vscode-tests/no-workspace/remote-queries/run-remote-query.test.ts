import { expect } from 'chai';
import * as os from 'os';
import { parseResponse } from '../../../remote-queries/run-remote-query';

describe('run-remote-query', () => {
  describe('parseResponse', () => {
    it('should parse a successful response', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
      });

      expect(result.popupMessage).to.equal('Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).');
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d'].join(os.EOL),
      );
    });

    it('should parse a successful response with only one repo', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b'],
      });

      expect(result.popupMessage).to.equal('Successfully scheduled runs on 1 repository. [Click here to see the progress](https://github.com/org/name/actions/runs/123).');
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 1 repository. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b'].join(os.EOL),
      );
    });

    it('should parse a response with invalid repos', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          invalid_repositories: ['e/f', 'g/h'],
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories were invalid and could not be found:',
          'e/f, g/h'].join(os.EOL)
      );
    });

    it('should parse a response with repos w/o databases', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          repositories_without_database: ['e/f', 'g/h'],
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories did not have a CodeQL database available:',
          'e/f, g/h',
          'For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.'].join(os.EOL)
      );
    });

    it('should parse a response with private repos', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          private_repositories: ['e/f', 'g/h'],
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories are not public:',
          'e/f, g/h',
          'When using a public controller repository, only public repositories can be queried.'].join(os.EOL)
      );
    });

    it('should parse a response with cutoff repos and cutoff repos count', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          cutoff_repositories: ['e/f', 'g/h'],
          cutoff_repositories_count: 2,
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories over the limit for a single request:',
          'e/f, g/h',
          'Repositories were selected based on how recently they had been updated.'].join(os.EOL)
      );
    });

    it('should parse a response with cutoff repos count but not cutoff repos', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          cutoff_repositories_count: 2,
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories over the limit for a single request.',
          'Repositories were selected based on how recently they had been updated.'].join(os.EOL)
      );
    });

    it('should parse a response with invalid repos and repos w/o databases', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
        errors: {
          invalid_repositories: ['e/f', 'g/h'],
          repositories_without_database: ['i/j', 'k/l'],
        }
      });

      expect(result.popupMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join(os.EOL)
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          '2 repositories were invalid and could not be found:',
          'e/f, g/h',
          '',
          '2 repositories did not have a CodeQL database available:',
          'i/j, k/l',
          'For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.'].join(os.EOL)
      );
    });
  });
});
