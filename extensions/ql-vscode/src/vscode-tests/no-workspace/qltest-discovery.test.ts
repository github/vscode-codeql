import 'vscode-test';
import 'mocha';
import { Uri } from 'vscode';
import { expect } from 'chai';

import { QLTestDiscovery } from '../../qltest-discovery';

describe('qltest-discovery', () => {
  describe('isRelevantQlPack', () => {
    it('should check if a qlpack is relevant', () => {
      const qlTestDiscover: any = new QLTestDiscovery(
        { onDidChangeQLPacks: () => ({}) } as any,
        { uri: Uri.parse('file:///a/b/c') } as any,
        {} as any
      );

      expect(qlTestDiscover.isRelevantQlPack({
        name: '-hucairz',
        uri: Uri.parse('file:///a/b/c/d')
      })).to.be.false;

      expect(qlTestDiscover.isRelevantQlPack({
        name: '-tests',
        uri: Uri.parse('file:///a/b/')
      })).to.be.false;

      expect(qlTestDiscover.isRelevantQlPack({
        name: '-tests',
        uri: Uri.parse('file:///a/b/c')
      })).to.be.true;

      expect(qlTestDiscover.isRelevantQlPack({
        name: '-tests',
        uri: Uri.parse('file:///a/b/c/d')
      })).to.be.true;
    });
  });
});
