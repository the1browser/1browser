'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const {
  authenticatedFixture,
  enabled,
} = require('../../../scripts/integration-test-support');

test(
  'real browser opens and runs tasks in two deterministic profiles',
  {skip: !enabled()},
  async (t) => {
    const server = http.createServer((_request, response) => {
      response.end('<title>SDK fixture</title><h1>ready</h1>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const {port} = server.address();

    try {
      const fixture = await authenticatedFixture(t);
      const prefix = `SDK Integration Profile ${Date.now()}-${process.pid}`;
      const ensured = await fixture.client.ensureProfiles({
        count: 2,
        namePrefix: prefix,
      });
      fixture.trackProfiles(ensured.created);
      const second = await fixture.client.ensureProfiles({
        count: 2,
        namePrefix: prefix,
      });
      assert.equal(second.created.length, 0);

      const results = await fixture.client.runForProfiles({
        profiles: ensured.profiles,
        concurrency: 2,
        task: async ({page}) => {
          await page.goto(`http://127.0.0.1:${port}`, {
            waitUntil: 'domcontentloaded',
          });
          return page.title();
        },
      });
      assert.equal(results.length, 2);
      assert.equal(
        results.every(
          ({success, value}) => success && value === 'SDK fixture',
        ),
        true,
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
