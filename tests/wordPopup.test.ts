import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OverlayRenderer } from '../src/content/overlayRenderer.ts';
import { WordPopup } from '../src/content/wordPopup.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function clickedToken(surface: string, base: string, reading: string) {
  const attributes = { 'data-base': base, 'data-reading': reading, 'data-surface': surface };
  return {
    dataset: { index: '0' },
    closest() { return this; },
    getAttribute(name: keyof typeof attributes) { return attributes[name]; },
    getBoundingClientRect() { return { left: 100, width: 40, top: 120 }; },
  };
}

function rendererHarness(dictionary: object, jlpt: object, text = '学生', base = '学生', reading = 'ガクセイ') {
  const renderer = new OverlayRenderer() as any;
  const calls: Array<{ surface: string; loading: boolean; level: string | null; entry: unknown }> = [];
  let visible = true;
  renderer.dictionaryService = dictionary;
  renderer.jlptService = jlpt;
  renderer.playerObserver = { pause() {} };
  renderer.wordPopup = {
    show(entry: unknown, surface: string, _x: number, _y: number, loading: boolean, level: string | null) {
      calls.push({ entry, surface, loading, level });
      visible = true;
    },
    hide() { visible = false; },
    isVisible() { return visible; },
  };
  renderer.overlayElement = { style: { display: 'block' } };
  renderer.renderedText = text;
  renderer.renderedTokens = [{ surface: text, baseForm: base, reading }];
  return { renderer, calls };
}

test('shows a reliable JLPT level even when JMdict has no entry', () => {
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    { isLoaded: () => true, lookup: () => 'N5' },
  );
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  assert.deepEqual(calls, [{ entry: null, surface: '学生', loading: false, level: 'N5' }]);
});

test('a newer click prevents an older dictionary result from replacing the popup', async () => {
  const pending = deferred();
  let loaded = false;
  const dictionary = {
    isLoaded: () => loaded,
    ensureLoaded: () => pending.promise,
    lookup: (base: string) => ({ expression: base, reading: '', meanings: [base] }),
  };
  const { renderer, calls } = rendererHarness(dictionary, { isLoaded: () => true, lookup: () => null });
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  renderer.renderedText = '先生';
  renderer.renderedTokens = [{ surface: '先生', baseForm: '先生', reading: 'センセイ' }];
  renderer.handleTokenClick({ target: clickedToken('先生', '先生', 'センセイ') });

  loaded = true;
  pending.resolve();
  await pending.promise;
  await Promise.resolve();

  assert.equal(calls.filter((call) => call.surface === '学生').length, 1);
  assert.equal(calls.at(-1)?.surface, '先生');
  assert.equal(calls.at(-1)?.loading, false);
});

test('JLPT completion updates the same word after cached token replacement', async () => {
  const pending = deferred();
  let loaded = false;
  const jlpt = {
    isLoaded: () => loaded,
    ensureLoaded: () => pending.promise,
    lookup: () => 'N5',
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    jlpt,
  );
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  renderer.renderedTokens = [{ surface: '学生', baseForm: '学生', reading: 'ガクセイ', jlptLevel: 'N5' }];

  loaded = true;
  pending.resolve();
  await pending.promise;
  await Promise.resolve();

  assert.deepEqual(calls.map((call) => call.level), [null, 'N5']);
});

class FakeElement {
  public tagName: string;
  public children: FakeElement[] = [];
  public parentElement: FakeElement | null = null;
  public className = '';
  public style: Record<string, any> = {
    display: '',
    setProperty(name: string, value: string) { this[name] = value; },
  };
  private ownText = '';

  constructor(tagName: string) { this.tagName = tagName; }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  appendChild(child: FakeElement) { child.parentElement = this; this.children.push(child); return child; }
  removeChild(child: FakeElement) { this.children.splice(this.children.indexOf(child), 1); child.parentElement = null; return child; }
  replaceChildren(...children: FakeElement[]) { this.ownText = ''; this.children = []; children.forEach((child) => this.appendChild(child)); }
  setAttribute() {}
  addEventListener() {}
  remove() { this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1); }
  getBoundingClientRect() { return { width: 180, height: 100 }; }
  contains(target: FakeElement): boolean { return this === target || this.children.some((child) => child.contains(target)); }
  find(className: string): FakeElement | undefined {
    return this.className === className ? this : this.children.map((child) => child.find(className)).find(Boolean);
  }
}

test('badge uses the shared palette and dictionary text remains text', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const body = new FakeElement('body');
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => { const node = new FakeElement('#text'); node.textContent = text; return node; },
      addEventListener() {},
      removeEventListener() {},
    },
    window: { innerWidth: 800 },
  });

  try {
    const popup = new WordPopup();
    popup.show(null, '学生', 200, 120, false, 'N5');
    const root = body.children[0];
    assert.equal(root.find('ja-word-popup-jlpt')?.textContent, 'N5');
    assert.equal(root.find('ja-word-popup-jlpt')?.style.backgroundColor, '#4CAF50');
    assert.match(root.textContent, /No dictionary entry found/);

    popup.show(
      { expression: '学生', reading: 'がくせい', meanings: ['<script>alert(1)</script>'], partOfSpeech: ['noun'] },
      '学生', 200, 120, false, 'N5',
    );
    assert.match(root.textContent, /<script>alert\(1\)<\/script>/);
    assert.equal(root.children.flatMap((child) => child.children).some((child) => child.tagName === 'script'), false);
    popup.destroy();
  } finally {
    Object.assign(globalThis, { document: previousDocument, window: previousWindow });
  }
});
