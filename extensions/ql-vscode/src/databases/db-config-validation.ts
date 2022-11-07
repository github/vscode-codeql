import { DbConfig } from './db-config';
import Ajv from 'ajv';

export function validateDbConfig(dbConfig: DbConfig): string[] {
  const ajv = new Ajv({ allErrors: true });

  const schema = {
    type: 'object',
    properties: {
      remote: {
        type: 'object',
        properties: {
          repositoryLists: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string'
                },
                repositories: {
                  type: 'array',
                  items: {
                    type: 'string',
                    pattern: '^[a-zA-Z0-9-_\\.]+/[a-zA-Z0-9-_\\.]+$'
                  }
                }
              },
              required: ['name', 'repositories'],
              additionalProperties: false
            }
          },
          owners: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^[a-zA-Z0-9-_\\.]+$'
            }
          },
          repositories: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^[a-zA-Z0-9-_\\.]+/[a-zA-Z0-9-_\\.]+$'
            }
          }
        },
        required: ['repositoryLists', 'owners', 'repositories'],
        additionalProperties: false
      }
    },
    required: ['remote'],
    additionalProperties: false
  };

  ajv.validate(schema, dbConfig);

  if (ajv.errors) {
    return ajv.errors.map((error) => `${error.instancePath} ${error.message}`);
  }

  return [];
}
