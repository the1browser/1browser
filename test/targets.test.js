'use strict';

const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');

const {
  createWindowAndResolveTarget,
  openProfilePage,
  targetIdFromPublicApi,
} = require('../src/targets');
const {ProfileTargetError} = require('../src/errors');

function fakeTarget(id, page = {close: async () => {}}) {
  return {
    async createCDPSession() {
      return {
        async send(method) {
          assert.equal(method, 'Target.getTargetInfo');
          return {targetInfo: {targetId: id}};
        },
        async detach() {},
      };
    },
    async page() {
      return page;
    },
  };
}

class FakeBrowser extends EventEmitter {
  constructor(targets = []) {
    super();
    this.currentTargets = targets;
  }

  targets() {
    return [...this.currentTargets];
  }

  addTarget(target) {
    this.currentTargets.push(target);
    this.emit('targetcreated', target);
  }

  async waitForTarget(predicate, {timeout}) {
    for (const target of this.currentTargets) {
      if (await predicate(target)) {
        return target;
      }
    }
    return new Promise((resolve, reject) => {
      let checking = false;
      const onTarget = async (target) => {
        if (checking) return;
        checking = true;
        if (await predicate(target)) {
          clearTimeout(timer);
          this.off('targetcreated', onTarget);
          resolve(target);
        }
        checking = false;
      };
      const timer = setTimeout(() => {
        this.off('targetcreated', onTarget);
        reject(new Error('Timed out'));
      }, timeout);
      this.on('targetcreated', onTarget);
    });
  }
}

test('uses a future public id method when available', async () => {
  let createdSession = false;
  const id = await targetIdFromPublicApi({
    id: () => 'public-id',
    createCDPSession: async () => {
      createdSession = true;
    },
  });
  assert.equal(id, 'public-id');
  assert.equal(createdSession, false);
});

test('uses public CDP APIs and never needs private target fields', async () => {
  const target = fakeTarget('cdp-id');
  target._targetId = 'wrong-private-id';
  assert.equal(await targetIdFromPublicApi(target), 'cdp-id');
});

test('matches a target that appears during window creation', async () => {
  const browser = new FakeBrowser([fakeTarget('unrelated')]);
  const match = fakeTarget('expected');
  const cdp = {
    async send() {
      browser.addTarget(match);
      return {windowId: 5, targetId: 'expected'};
    },
  };
  const result = await createWindowAndResolveTarget({
    browser,
    cdp,
    profileId: 'profile-id',
    timeoutMs: 50,
  });
  assert.equal(result.target, match);
  assert.equal(browser.listenerCount('targetcreated'), 0);
});

test('waits for a matching target and ignores unrelated targets', async () => {
  const browser = new FakeBrowser();
  const match = fakeTarget('expected');
  const cdp = {
    async send() {
      setImmediate(() => {
        browser.addTarget(fakeTarget('unrelated'));
        setImmediate(() => browser.addTarget(match));
      });
      return {windowId: 5, targetId: 'expected'};
    },
  };
  const result = await createWindowAndResolveTarget({
    browser,
    cdp,
    profileId: 'profile-id',
    timeoutMs: 50,
  });
  assert.equal(result.target, match);
  assert.equal(browser.listenerCount('targetcreated'), 0);
});

test('cleans up its listener after a timeout', async () => {
  const browser = new FakeBrowser();
  const cdp = {
    async send() {
      return {targetId: 'missing'};
    },
  };
  await assert.rejects(
    createWindowAndResolveTarget({
      browser,
      cdp,
      profileId: 'profile-id',
      timeoutMs: 5,
    }),
    ProfileTargetError,
  );
  assert.equal(browser.listenerCount('targetcreated'), 0);
});

test('rejects a resolved target that has no page', async () => {
  const target = fakeTarget('expected', null);
  const browser = new FakeBrowser([target]);
  await assert.rejects(
    openProfilePage({
      browser,
      cdp: {send: async () => ({targetId: 'expected'})},
      profileId: 'profile-id',
      timeoutMs: 50,
    }),
    /not a Puppeteer Page/,
  );
});
