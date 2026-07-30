'use strict';

const {ProfileTargetError} = require('./errors');

async function targetIdFromPublicApi(target) {
  if (typeof target.id === 'function') {
    return target.id();
  }

  let session;
  try {
    session = await target.createCDPSession();
    const {targetInfo} = await session.send('Target.getTargetInfo');
    return targetInfo?.targetId;
  } finally {
    if (session) {
      await session.detach().catch(() => {});
    }
  }
}

async function matchesTargetId(target, targetId) {
  try {
    return (await targetIdFromPublicApi(target)) === targetId;
  } catch {
    return false;
  }
}

async function createWindowAndResolveTarget({
  browser,
  cdp,
  profileId,
  timeoutMs = 30_000,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ProfileTargetError('timeoutMs must be a positive number.');
  }

  const observed = new Set(browser.targets());
  const observe = (target) => observed.add(target);
  browser.on('targetcreated', observe);
  const started = Date.now();

  try {
    const windowResult = await cdp.send('Browser.createWindowForProfile', {
      profileId,
    });
    const targetId = windowResult?.targetId;
    if (typeof targetId !== 'string' || targetId === '') {
      throw new ProfileTargetError(
        'Browser.createWindowForProfile did not return a targetId.',
      );
    }

    for (const target of observed) {
      if (await matchesTargetId(target, targetId)) {
        return {...windowResult, targetId, target};
      }
    }

    const remaining = Math.max(1, timeoutMs - (Date.now() - started));
    const target = await browser.waitForTarget(
      (candidate) => matchesTargetId(candidate, targetId),
      {timeout: remaining},
    );
    return {...windowResult, targetId, target};
  } catch (error) {
    if (error instanceof ProfileTargetError) {
      throw error;
    }
    throw new ProfileTargetError(
      `Unable to resolve the Puppeteer target for profile ${profileId} within ${timeoutMs} ms.`,
      {cause: error},
    );
  } finally {
    browser.off('targetcreated', observe);
  }
}

async function openProfilePage({browser, cdp, profileId, timeoutMs}) {
  const resolved = await createWindowAndResolveTarget({
    browser,
    cdp,
    profileId,
    timeoutMs,
  });

  let page;
  try {
    page = await resolved.target.page();
  } catch (error) {
    throw new ProfileTargetError(
      `The target for profile ${profileId} could not be opened as a page.`,
      {cause: error},
    );
  }
  if (!page || typeof page.close !== 'function') {
    throw new ProfileTargetError(
      `The target for profile ${profileId} is not a Puppeteer Page.`,
    );
  }
  return {
    profileId,
    windowId: resolved.windowId,
    targetId: resolved.targetId,
    target: resolved.target,
    page,
  };
}

module.exports = {
  createWindowAndResolveTarget,
  openProfilePage,
  targetIdFromPublicApi,
};
