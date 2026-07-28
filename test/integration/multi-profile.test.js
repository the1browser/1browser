'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const {
  OneBrowser,
  loadEnvironmentConfig,
} = require('../../src');

const enabled = process.env.ONE_BROWSER_INTEGRATION === '1';

test(
  'real browser opens and runs tasks in two deterministic profiles',
  {skip: !enabled},
  async () => {
    const server = http.createServer((_request, response) => {
      response.end('<title>SDK fixture</title><h1>ready</h1>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const {port} = server.address();

    let client;
    try {
      client = await OneBrowser.launch(loadEnvironmentConfig());
      await client.ensureAuthenticated();
      const ensured = await client.ensureProfiles({
        count: 2,
        namePrefix: 'SDK Integration Profile',
      });
      const second = await client.ensureProfiles({
        count: 2,
        namePrefix: 'SDK Integration Profile',
      });
      assert.equal(second.created.length, 0);

      const results = await client.runForProfiles({
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
      if (client) {
        await client.close();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
