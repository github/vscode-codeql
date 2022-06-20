import * as sinon from 'sinon';
import { expect } from 'chai';
import * as pq from 'proxyquire';

const proxyquire = pq.noPreserveCache();

describe('repository', function() {

  describe('getControllerRepoSelection', () => {
    let sandbox: sinon.SinonSandbox;
    let getControllerRepoSpy: sinon.SinonStub;
    let mod: any;
    beforeEach(() => {
      sandbox = sinon.createSandbox();
      getControllerRepoSpy = sandbox.stub();
      mod = proxyquire('../../../remote-queries/repository', {
        '../config': {
          getControllerRepo: getControllerRepoSpy
        },
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should allow you to set a controller repo from your pre-defined config', async () => {
      // fake return values
      getControllerRepoSpy.returns('test-owner/test-controller-repo');

      // make the function call
      const controllerRepoSelection = await mod.getControllerRepoSelection();

      // Check that the return value is correct
      expect(controllerRepoSelection).to.deep.eq('test-owner/test-controller-repo');
    });

    // it(`should allow you to enter a controller repo from a text box: ${repo}`, async () => {
    // });

  });
});
