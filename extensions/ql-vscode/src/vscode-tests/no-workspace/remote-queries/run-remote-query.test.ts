import { expect } from 'chai';
import { parseResponse } from '../../../remote-queries/run-remote-query';

describe('run-remote-query', () => {
  describe('parseResponse', () => {
    it('should parse a successful response', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
        repositories_queried: ['a/b', 'c/d'],
      });

      expect(result.popupMessage).to.equal('Successfully scheduled runs. [Click here to see the progress](https://github.com/org/name/actions/runs/123).');
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d'].join('\n')
      );
    });

    it('should parse a response with no repositories queried', () => {
      const result = parseResponse('org', 'name', {
        workflow_run_id: 123,
      });

      expect(result.popupMessage).to.equal('Successfully scheduled runs. [Click here to see the progress](https://github.com/org/name/actions/runs/123).');
      expect(result.logMessage).to.equal(
        'Successfully scheduled runs. See https://github.com/org/name/actions/runs/123.'
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
        ['Successfully scheduled runs. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join('\n')
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:',
          'a/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          'Invalid repositories:',
          'e/f, g/h'].join('\n')
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
        ['Successfully scheduled runs. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join('\n')
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:\na/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          'Repositories without databases:\ne/f, g/h'].join('\n')
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
        ['Successfully scheduled runs. [Click here to see the progress](https://github.com/org/name/actions/runs/123).',
          '',
          'Some repositories could not be scheduled. See extension log for details.'].join('\n')
      );
      expect(result.logMessage).to.equal(
        ['Successfully scheduled runs. See https://github.com/org/name/actions/runs/123.',
          '',
          'Repositories queried:\na/b, c/d',
          '',
          'Some repositories could not be scheduled.',
          '',
          'Invalid repositories:',
          'e/f, g/h',
          '',
          'Repositories without databases:',
          'i/j, k/l'].join('\n')
      );
    });
  });
});
