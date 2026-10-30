import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test, { type TestContext } from 'node:test';
import {
  getGameUrl,
  getShareText,
  shareResultCard,
  type PreparedResultCard,
  type ShareResult,
} from '../src/share.ts';

const gameUrl = 'https://cadmium2525.github.io/nira/';
const result: ShareResult = {
  throws: [
    { name: 'ぐにゃり', distance: 85, out: false },
    { name: 'ふわり', distance: 96.6, out: false },
  ],
  best: 96.6,
};

function setGlobal(t: TestContext, name: string, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
}

function mockLocation(t: TestContext): void {
  setGlobal(t, 'window', {
    location: { href: `${gameUrl}?debug=true&seed=42#results` },
  });
}

function preparedCard(): PreparedResultCard {
  const file = new File(['result card'], 'nira-throw-96.6m.png', { type: 'image/png' });
  return {
    blob: file,
    file: file as PreparedResultCard['file'],
    url: 'blob:nira-result-card',
    text: getShareText(result),
    gameUrl,
  };
}

test('record post includes distance, game introduction, both hashtags, and clean game URL', (t) => {
  mockLocation(t);
  const text = getShareText(result);
  assert.match(text, /ニラを 96\.6m 飛ばした！/);
  assert.match(text, /長押し＆スワイプ/);
  assert.match(text, /#ニラ飛ばし #NIRATHROW/);
  assert.ok(text.endsWith(`\n${gameUrl}`));
  assert.equal(getGameUrl(), gameUrl);
  assert.doesNotMatch(text, /debug|seed|#results/);
});

test('two out-of-bounds throws share the outcome with introduction, hashtags, and game URL', (t) => {
  mockLocation(t);
  const text = getShareText({
    throws: result.throws.map((item) => ({ ...item, out: true })),
    best: 0,
  });
  assert.match(text, /2投とも場外/);
  assert.doesNotMatch(text, /0\.0m 飛ばした/);
  assert.match(text, /長押し＆スワイプ/);
  assert.match(text, /#ニラ飛ばし #NIRATHROW/);
  assert.ok(text.endsWith(`\n${gameUrl}`));
});

test('native image sharing sends complete post as text without a separate URL field', async (t) => {
  mockLocation(t);
  const prepared = preparedCard();
  const calls: ShareData[] = [];
  setGlobal(t, 'navigator', {
    canShare(data: ShareData) {
      assert.deepEqual(data.files, [prepared.file]);
      return true;
    },
    async share(data: ShareData) {
      calls.push(data);
    },
  });

  assert.equal(await shareResultCard(prepared), 'shared');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].files, [prepared.file]);
  assert.equal(calls[0].text, prepared.text);
  assert.equal(Object.hasOwn(calls[0], 'url'), false,
    'keep the game URL in the caption instead of a competing native URL item');
});

test('cancelling native sharing does not download a card or copy post text', async (t) => {
  mockLocation(t);
  const prepared = preparedCard();
  let shareCount = 0;
  let copyCount = 0;
  let downloadCount = 0;
  setGlobal(t, 'navigator', {
    canShare: () => true,
    async share() {
      shareCount += 1;
      const error = new Error('The user cancelled sharing.');
      error.name = 'AbortError';
      throw error;
    },
    clipboard: { async writeText() { copyCount += 1; } },
  });
  setGlobal(t, 'document', {
    createElement() {
      downloadCount += 1;
      throw new Error('Cancellation must not trigger a download.');
    },
  });

  assert.equal(await shareResultCard(prepared), 'cancelled');
  assert.equal(shareCount, 1);
  assert.equal(copyCount, 0);
  assert.equal(downloadCount, 0);
});
