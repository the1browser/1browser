'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ensureAuthenticated,
  waitForAuthenticatedState,
} = require('../src/auth');
const {
  AuthenticationError,
  AuthenticationTimeoutError,
} = require('../src/errors');

function session(handler) {
  const calls = [];
  return {
    calls,
    cdp: {
      async send(method, params) {
        calls.push({method, params});
        return handler(method, params);
      },
    },
  };
}

function deterministicTimer() {
  let currentTime = 0;
  let activeWaits = 0;
  let waitCount = 0;
  return {
    now: () => currentTime,
    async wait(milliseconds, signal) {
      activeWaits += 1;
      waitCount += 1;
      try {
        if (signal?.aborted) {
          throw signal.reason;
        }
        currentTime += milliseconds;
      } finally {
        activeWaits -= 1;
      }
    },
    get activeWaits() {
      return activeWaits;
    },
    get waitCount() {
      return waitCount;
    },
  };
}

test('reuses a signed-in session without signin or interactive login', async () => {
  const {calls, cdp} = session(() => ({
    signedIn: true,
    state: 'signed_in',
  }));
  const state = await ensureAuthenticated(cdp, {});
  assert.equal(state.signedIn, true);
  assert.deepEqual(calls, [
    {
      method: 'Browser.getAuthState',
      params: {validateOnline: true},
    },
  ]);
});

test('complete credentials sign in and confirm online authentication', async () => {
  const states = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: false, state: 'unknown'},
    {signedIn: true, state: 'signed_in'},
  ];
  const {calls, cdp} = session((method) => {
    if (method === 'Browser.getAuthState') {
      return states.shift();
    }
    return {success: true, responseCode: 200};
  });

  const state = await ensureAuthenticated(
    cdp,
    {credentials: {email: 'person@example.com', password: 'secret'}},
    {
      timeoutMs: 100,
      pollIntervalMs: 10,
      timer: deterministicTimer(),
    },
  );

  assert.equal(state.signedIn, true);
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAuthState',
      'Browser.signin',
      'Browser.getAuthState',
      'Browser.getAuthState',
    ],
  );
  assert.deepEqual(calls[1].params, {
    email: 'person@example.com',
    password: 'secret',
  });
  assert.equal(
    calls.some(({method}) => method === 'Browser.login'),
    false,
  );
});

test('method credentials override launch credentials by field', async () => {
  const states = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: true, state: 'signed_in'},
  ];
  const {calls, cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? states.shift()
      : {success: true, responseCode: 200},
  );
  await ensureAuthenticated(
    cdp,
    {credentials: {email: 'old@example.com', password: 'launch-secret'}},
    {
      email: 'new@example.com',
      timeoutMs: 20,
      pollIntervalMs: 1,
      timer: deterministicTimer(),
    },
  );
  assert.deepEqual(calls[1], {
    method: 'Browser.signin',
    params: {email: 'new@example.com', password: 'launch-secret'},
  });
});

test('unsuccessful credential sign-in stays visible and never falls back', async () => {
  const secret = 'hidden-secret';
  const {calls, cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? {signedIn: false, state: 'signed_out'}
      : {success: false, responseCode: 401},
  );
  await assert.rejects(
    ensureAuthenticated(cdp, {
      credentials: {email: 'person@example.com', password: secret},
    }),
    (error) =>
      error instanceof AuthenticationError &&
      error.message.includes('401') &&
      !error.message.includes(secret),
  );
  assert.equal(
    calls.some(({method}) => method === 'Browser.login'),
    false,
  );
});

test('credential confirmation uses its own bounded timeout', async () => {
  const timer = deterministicTimer();
  const {cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? {signedIn: false, state: 'unknown'}
      : {success: true, responseCode: 200},
  );
  await assert.rejects(
    ensureAuthenticated(
      cdp,
      {credentials: {email: 'person@example.com', password: 'secret'}},
      {timeoutMs: 10, pollIntervalMs: 4, timer},
    ),
    (error) =>
      error instanceof AuthenticationTimeoutError &&
      error.code === 'ERR_ONE_BROWSER_AUTH_TIMEOUT' &&
      error.message.includes('10 ms'),
  );
  assert.equal(timer.activeWaits, 0);
});

test('auto mode opens interactive login once and notifies once', async () => {
  const states = [
    {signedIn: false, state: 'signed_out'},
    {signedIn: false, state: 'signed_out'},
    {signedIn: true, state: 'signed_in'},
  ];
  const target = {windowId: 17, targetId: 'login-target'};
  const {calls, cdp} = session((method) => {
    if (method === 'Browser.getAuthState') {
      return states.shift();
    }
    if (method === 'Browser.login') {
      return target;
    }
    throw new Error(`Unexpected method ${method}`);
  });
  const notifications = [];

  const state = await ensureAuthenticated(cdp, {}, {
    interactiveTimeoutMs: 50,
    pollIntervalMs: 5,
    timer: deterministicTimer(),
    onInteractiveLogin(openedTarget) {
      notifications.push(openedTarget);
    },
  });

  assert.equal(state.signedIn, true);
  assert.deepEqual(notifications, [target]);
  assert.equal(
    calls.filter(({method}) => method === 'Browser.login').length,
    1,
  );
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      'Browser.getAuthState',
      'Browser.login',
      'Browser.getAuthState',
      'Browser.getAuthState',
    ],
  );
});

test('interactive login validates its target before polling', async () => {
  const {calls, cdp} = session((method) =>
    method === 'Browser.getAuthState'
      ? {signedIn: false, state: 'signed_out'}
      : {windowId: 'invalid', targetId: ''},
  );
  await assert.rejects(
    ensureAuthenticated(cdp, {}, {interactiveTimeoutMs: 10}),
    /Browser\.login returned an invalid target/,
  );
  assert.deepEqual(
    calls.map(({method}) => method),
    ['Browser.getAuthState', 'Browser.login'],
  );
});

test('interactive login has a distinct bounded timeout and leaves no wait', async () => {
  const timer = deterministicTimer();
  const {calls, cdp} = session((method) =>
    method === 'Browser.login'
      ? {windowId: 1, targetId: 'login'}
      : {signedIn: false, state: 'signed_out'},
  );

  await assert.rejects(
    ensureAuthenticated(cdp, {}, {
      timeoutMs: 1,
      interactiveTimeoutMs: 12,
      pollIntervalMs: 5,
      timer,
    }),
    (error) =>
      error instanceof AuthenticationTimeoutError &&
      error.code === 'ERR_ONE_BROWSER_AUTH_INTERACTIVE_TIMEOUT' &&
      error.message.includes('12 ms'),
  );
  assert.equal(
    calls.filter(({method}) => method === 'Browser.login').length,
    1,
  );
  assert.equal(timer.activeWaits, 0);
});

test('authentication modes select the documented branch', async (t) => {
  const cases = [
    {
      name: 'auto without credentials uses interactive login',
      mode: 'auto',
      expected: 'Browser.login',
    },
    {
      name: 'auto with credentials uses credential signin',
      mode: 'auto',
      credentials: {email: 'person@example.com', password: 'secret'},
      expected: 'Browser.signin',
    },
    {
      name: 'credentials-only with credentials uses credential signin',
      mode: 'credentials-only',
      credentials: {email: 'person@example.com', password: 'secret'},
      expected: 'Browser.signin',
    },
    {
      name: 'interactive-only ignores configured credentials',
      mode: 'interactive-only',
      credentials: {email: 'person@example.com', password: 'secret'},
      expected: 'Browser.login',
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      let authReads = 0;
      const {calls, cdp} = session((method) => {
        if (method === 'Browser.getAuthState') {
          authReads += 1;
          return {
            signedIn: authReads > 1,
            state: authReads > 1 ? 'signed_in' : 'signed_out',
          };
        }
        if (method === 'Browser.login') {
          return {windowId: 1, targetId: 'login'};
        }
        return {success: true, responseCode: 200};
      });
      await ensureAuthenticated(
        cdp,
        {credentials: fixture.credentials, auth: {mode: fixture.mode}},
        {timer: deterministicTimer()},
      );
      assert.equal(calls[1].method, fixture.expected);
    });
  }
});

test('fail-fast modes do not open login UI', async (t) => {
  await t.test('credentials-only requires credentials', async () => {
    const {calls, cdp} = session(() => ({
      signedIn: false,
      state: 'signed_out',
    }));
    await assert.rejects(
      ensureAuthenticated(cdp, {auth: {mode: 'credentials-only'}}),
      (error) => error.code === 'ERR_ONE_BROWSER_AUTH_REQUIRED',
    );
    assert.equal(calls.length, 1);
  });

  await t.test('error succeeds for a persisted session', async () => {
    const {calls, cdp} = session(() => ({
      signedIn: true,
      state: 'signed_in',
    }));
    await ensureAuthenticated(cdp, {auth: {mode: 'error'}});
    assert.equal(calls.length, 1);
  });

  await t.test('error rejects an unauthenticated session', async () => {
    const {calls, cdp} = session(() => ({
      signedIn: false,
      state: 'signed_out',
    }));
    await assert.rejects(
      ensureAuthenticated(cdp, {auth: {mode: 'error'}}),
      (error) =>
        error.code === 'ERR_ONE_BROWSER_AUTH_INTERACTIVE_DISABLED',
    );
    assert.equal(calls.length, 1);
  });
});

test('partial credentials are rejected unless the mode ignores them', async (t) => {
  for (const credentials of [
    {email: 'person@example.com'},
    {password: 'secret'},
  ]) {
    await t.test(JSON.stringify(Object.keys(credentials)), async () => {
      const {calls, cdp} = session(() => ({
        signedIn: false,
        state: 'signed_out',
      }));
      await assert.rejects(
        ensureAuthenticated(cdp, {credentials}),
        (error) =>
          error.code ===
          'ERR_ONE_BROWSER_AUTH_CREDENTIALS_INCOMPLETE',
      );
      assert.equal(calls.length, 1);
    });
  }

  await t.test('interactive-only ignores a partial pair', async () => {
    let reads = 0;
    const {calls, cdp} = session((method) => {
      if (method === 'Browser.getAuthState') {
        reads += 1;
        return {signedIn: reads > 1};
      }
      return {windowId: 1, targetId: 'login'};
    });
    await ensureAuthenticated(
      cdp,
      {
        credentials: {email: 'person@example.com'},
        auth: {mode: 'interactive-only'},
      },
      {timer: deterministicTimer()},
    );
    assert.equal(calls[1].method, 'Browser.login');
  });
});

test('authentication option validation rejects invalid values', async (t) => {
  for (const options of [
    {mode: 'unsupported'},
    {timeoutMs: 0},
    {interactiveTimeoutMs: Number.POSITIVE_INFINITY},
    {pollIntervalMs: -1},
    {onInteractiveLogin: true},
  ]) {
    await t.test(JSON.stringify(options), async () => {
      const {calls, cdp} = session(() => ({signedIn: true}));
      await assert.rejects(
        ensureAuthenticated(cdp, {}, options),
        AuthenticationError,
      );
      assert.equal(calls.length, 0);
    });
  }
});

test('shared polling can be cancelled without leaving an active timer', async () => {
  const controller = new AbortController();
  let activeWaits = 0;
  const timer = {
    now: () => 0,
    wait(_milliseconds, signal) {
      activeWaits += 1;
      return new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            activeWaits -= 1;
            reject(signal.reason);
          },
          {once: true},
        );
      });
    },
  };
  const {cdp} = session(() => ({
    signedIn: false,
    state: 'signed_out',
  }));
  const reason = new Error('cancelled');
  const pending = waitForAuthenticatedState(cdp, {
    timeoutMs: 100,
    pollIntervalMs: 10,
    operation: 'Authentication was not confirmed',
    signal: controller.signal,
    timer,
  });
  await new Promise(setImmediate);
  assert.equal(activeWaits, 1);
  controller.abort(reason);
  await assert.rejects(pending, reason);
  assert.equal(activeWaits, 0);
});
