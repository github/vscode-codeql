import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Uri, WorkspaceFolder } from 'vscode';
import * as fs from 'fs-extra';

import { QLTestDiscovery } from '../../qltest-discovery';

describe('qltest-discovery', () => {
  describe('discoverTests', () => {
    const baseUri = Uri.parse('file:/a/b');
    const baseDir = baseUri.fsPath;
    const cDir = Uri.parse('file:/a/b/c').fsPath;
    const dFile = Uri.parse('file:/a/b/c/d.ql').fsPath;
    const eFile = Uri.parse('file:/a/b/c/e.ql').fsPath;
    const hDir = Uri.parse('file:/a/b/c/f/g/h').fsPath;
    const iFile = Uri.parse('file:/a/b/c/f/g/h/i.ql').fsPath;
    let qlTestDiscover: QLTestDiscovery;

    beforeEach(() => {
      qlTestDiscover = new QLTestDiscovery(
        {
          uri: baseUri,
          name: 'My tests'
        } as unknown as WorkspaceFolder,
        {
          resolveTests() {
            return [
              Uri.parse('file:/a/b/c/d.ql').fsPath,
              Uri.parse('file:/a/b/c/e.ql').fsPath,
              Uri.parse('file:/a/b/c/f/g/h/i.ql').fsPath
            ];
          }
        } as any
      );

    });

    it('should run discovery', async () => {
      jest.spyOn(fs, 'pathExists').mockImplementation(() => Promise.resolve(true));

      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).toEqual(baseDir);
      expect(result.testDirectory.path).toEqual(baseDir);
      expect(result.testDirectory.name).toEqual('My tests');

      let children = result.testDirectory.children;
      expect(children[0].path).toEqual(cDir);
      expect(children[0].name).toEqual('c');
      expect(children.length).toEqual(1);

      children = children[0].children;
      expect(children[0].path).toEqual(dFile);
      expect(children[0].name).toEqual('d.ql');
      expect(children[1].path).toEqual(eFile);
      expect(children[1].name).toEqual('e.ql');

      // A merged foler
      expect(children[2].path).toEqual(hDir);
      expect(children[2].name).toEqual('f / g / h');
      expect(children.length).toEqual(3);

      children = children[2].children;
      expect(children[0].path).toEqual(iFile);
      expect(children[0].name).toEqual('i.ql');
    });

    it('should avoid discovery if a folder does not exist', async () => {
      jest.spyOn(fs, 'pathExists').mockImplementation(() => Promise.resolve(false));

      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).toEqual(baseDir);
      expect(result.testDirectory.path).toEqual(baseDir);
      expect(result.testDirectory.name).toEqual('My tests');

      expect(result.testDirectory.children).toEqual([]);
    });
  });
});
