import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { DownloadLink, toDownloadPath } from '../../remote-queries/download-link';

describe('toDownloadPath', () => {
  it('should return the correct path', () => {
    const downloadLink: DownloadLink = {
      id: 'abc',
      urlPath: '',
      innerFilePath: '',
      queryId: 'def'
    };

    const expectedPath = path.join('storage', 'def', 'abc');
    expect(toDownloadPath('storage', downloadLink)).to.equal(expectedPath);
  });

  it('should return the correct path with extension', () => {
    const downloadLink: DownloadLink = {
      id: 'abc',
      urlPath: '',
      innerFilePath: '',
      queryId: 'def'
    };

    const expectedPath = path.join('storage', 'def', 'abc.zip');
    expect(toDownloadPath('storage', downloadLink, 'zip')).to.equal(expectedPath);
  });
});
