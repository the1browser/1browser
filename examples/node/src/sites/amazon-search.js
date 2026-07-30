'use strict';

const CAPTCHA_SELECTORS = [
  '#captchacharacters',
  'form[action*="validateCaptcha"]',
];
const SEARCH_INPUT_SELECTORS = [
  '#twotabsearchtextbox',
  'input[name="field-keywords"]',
];
const SEARCH_SUBMIT_SELECTORS = [
  '#nav-search-submit-button',
  'input[type="submit"][value="Go"]',
];

async function detectManualVerification(page) {
  for (const selector of CAPTCHA_SELECTORS) {
    if (await page.$(selector)) {
      return true;
    }
  }
  const title = (await page.title()).toLowerCase();
  const text = await page.evaluate(() => document.body?.innerText ?? '');
  return (
    title.includes('robot check') ||
    /enter the characters you see|manual verification|automated access/i.test(
      text,
    )
  );
}

async function waitForFirstSelector(page, selectors, timeoutMs = 15_000) {
  const handle = await page.waitForFunction(
    (candidates) =>
      candidates.find((selector) => document.querySelector(selector)) ?? false,
    {timeout: timeoutMs},
    selectors,
  );
  const selector = await handle.jsonValue();
  await handle.dispose();
  return selector;
}

async function searchAmazon(page, {targetUrl, query}) {
  await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (await detectManualVerification(page)) {
    throw new Error(
      'Amazon requested CAPTCHA or manual verification; this example will not bypass it.',
    );
  }

  const inputSelector = await waitForFirstSelector(
    page,
    SEARCH_INPUT_SELECTORS,
  );
  await page.click(inputSelector, {clickCount: 3});
  await page.type(inputSelector, query);

  const submitSelector = await waitForFirstSelector(
    page,
    SEARCH_SUBMIT_SELECTORS,
  ).catch(() => undefined);
  if (submitSelector) {
    await page.click(submitSelector);
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForFunction(
    (expectedQuery) => {
      const url = new URL(window.location.href);
      const resultQuery = url.searchParams.get('k');
      const bodyText = document.body?.innerText ?? '';
      return (
        resultQuery?.toLowerCase() === expectedQuery.toLowerCase() ||
        document.querySelector('[data-component-type="s-search-result"]') ||
        document.querySelector('#captchacharacters') ||
        document.querySelector('form[action*="validateCaptcha"]') ||
        /enter the characters you see|manual verification|automated access/i.test(
          bodyText,
        )
      );
    },
    {timeout: 30_000},
    query,
  );

  if (await detectManualVerification(page)) {
    throw new Error(
      'Amazon requested CAPTCHA or manual verification; this example will not bypass it.',
    );
  }
  const resultCount = await page.$$eval(
    '[data-component-type="s-search-result"]',
    (elements) => elements.length,
  );
  if (!page.url().includes('/s?') && resultCount === 0) {
    throw new Error('Amazon search could not be verified.');
  }
  return {
    query,
    url: page.url(),
    title: await page.title(),
    resultCount,
  };
}

module.exports = {searchAmazon};
