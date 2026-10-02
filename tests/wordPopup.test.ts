import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OverlayRenderer } from '../src/content/overlayRenderer.ts';
import { WordPopup } from '../src/content/wordPopup.ts';
import { createVocabularyIdentity } from '../src/storage/vocabularyIdentity.ts';

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

function rendererHarness(
  dictionary: object,
  jlpt: object,
  text = '学生',
  base = '学生',
  reading = 'ガクセイ',
  vocabulary: object = {
    isSaved: async () => false,
    save: async (draft: object) => ({ ...draft, id: 'saved' }),
    remove: async () => undefined,
    subscribe: () => () => {},
  },
) {
  const renderer = new OverlayRenderer() as any;
  const calls: Array<{ surface: string; loading: boolean; level: string | null; entry: any; bookmark: any }> = [];
  let visible = true;
  let pauseCount = 0;
  renderer.dictionaryService = dictionary;
  renderer.jlptService = jlpt;
  renderer.vocabularyStorage = vocabulary;
  renderer.playerObserver = { pause() { pauseCount += 1; }, getVocabularySource: () => undefined };
  renderer.wordPopup = {
    show(entry: unknown, surface: string, _x: number, _y: number, loading: boolean, level: string | null, bookmark: unknown) {
      calls.push({ entry, surface, loading, level, bookmark });
      visible = true;
    },
    hide() { visible = false; },
    isVisible() { return visible; },
  };
  renderer.overlayElement = { style: { display: 'block' } };
  renderer.renderedText = text;
  renderer.renderedTokens = [{ surface: text, baseForm: base, reading }];
  return { renderer, calls, getPauseCount: () => pauseCount };
}

test('token click pauses playback and shows a reliable JLPT level without JMdict', async () => {
  const { renderer, calls, getPauseCount } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    { isLoaded: () => true, lookup: () => 'N5' },
  );
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  await Promise.resolve();
  assert.equal(calls.at(-1)?.entry, null);
  assert.equal(calls.at(-1)?.surface, '学生');
  assert.equal(calls.at(-1)?.loading, false);
  assert.equal(calls.at(-1)?.level, 'N5');
  assert.equal(calls.at(-1)?.bookmark.isSaved, false);
  assert.equal(calls.at(-1)?.bookmark.pending, false);
  assert.equal(getPauseCount(), 1);
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

  assert.equal(calls[0].level, null);
  assert.equal(calls.at(-1)?.level, 'N5');
});

class FakeElement {
  public tagName: string;
  public children: FakeElement[] = [];
  public parentElement: FakeElement | null = null;
  public className = '';
  public disabled = false;
  public attributes: Record<string, string> = {};
  public listeners = new Map<string, () => void>();
  public style: Record<string, any> = {
    display: '',
    setProperty(name: string, value: string) { this[name] = value; },
  };
  private ownText = '';

  constructor(tagName: string) { this.tagName = tagName; }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  appendChild(child: FakeElement) { child.parentElement = this; this.children.push(child); return child; }
  append(...children: FakeElement[]) { children.forEach((child) => this.appendChild(child)); }
  removeChild(child: FakeElement) { this.children.splice(this.children.indexOf(child), 1); child.parentElement = null; return child; }
  replaceChildren(...children: FakeElement[]) { this.ownText = ''; this.children = []; children.forEach((child) => this.appendChild(child)); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener(name: string, handler: () => void) { this.listeners.set(name, handler); }
  remove() { this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1); }
  getBoundingClientRect() { return { width: 180, height: 100 }; }
  contains(target: FakeElement): boolean { return this === target || this.children.some((child) => child.contains(target)); }
  closest(selector: string): FakeElement | null {
    return selector === '.ja-token' && this.className.split(' ').includes('ja-token') ? this : this.parentElement?.closest(selector) ?? null;
  }
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
    window: { innerWidth: 800, innerHeight: 600 },
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

test('Escape and outside clicks dismiss the popup while token clicks do not', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const body = new FakeElement('body');
  const listeners = new Map<string, (event: any) => void>();
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => { const node = new FakeElement('#text'); node.textContent = text; return node; },
      addEventListener: (name: string, handler: (event: any) => void) => { listeners.set(name, handler); },
      removeEventListener: (name: string) => { listeners.delete(name); },
    },
    window: { innerWidth: 800, innerHeight: 600 },
  });
  try {
    const popup = new WordPopup();
    popup.show(null, '学生', 200, 120);
    const token = new FakeElement('span');
    token.className = 'ja-token';
    listeners.get('click')?.({ target: token });
    assert.equal(popup.isVisible(), true);

    listeners.get('click')?.({ target: new FakeElement('div') });
    assert.equal(popup.isVisible(), false);

    popup.show(null, '学生', 200, 120);
    listeners.get('keydown')?.({ key: 'Escape' });
    assert.equal(popup.isVisible(), false);
    popup.destroy();
  } finally {
    Object.assign(globalThis, { document: previousDocument, window: previousWindow });
  }
});

test('bookmark control exposes accessible unsaved, pending, saved, and error states', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const body = new FakeElement('body');
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => { const node = new FakeElement('#text'); node.textContent = text; return node; },
      addEventListener() {}, removeEventListener() {},
    },
    window: { innerWidth: 800, innerHeight: 600 },
  });

  try {
    const popup = new WordPopup();
    let toggles = 0;
    popup.show(null, '学生', 200, 120, false, null, {
      isSaved: false, pending: false, error: null, onToggle: () => { toggles += 1; },
    });
    let button = body.children[0].find('ja-word-popup-bookmark')!;
    assert.equal(button.textContent, '☆Save Word');
    assert.equal(button.attributes['aria-pressed'], 'false');
    button.listeners.get('click')?.();
    assert.equal(toggles, 1);

    popup.show(null, '学生', 200, 120, false, null, {
      isSaved: true, pending: true, error: null, onToggle: () => { toggles += 1; },
    });
    button = body.children[0].find('ja-word-popup-bookmark')!;
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, '…Updating…');
    button.listeners.get('click')?.();
    assert.equal(toggles, 1);

    popup.show(null, '学生', 200, 120, false, null, {
      isSaved: true, pending: false, error: 'Storage unavailable', onToggle: () => {},
    });
    assert.equal(body.children[0].find('ja-word-popup-bookmark')?.textContent, '★Saved');
    assert.equal(body.children[0].find('ja-word-popup-bookmark-error')?.textContent, 'Storage unavailable');
    popup.destroy();
  } finally {
    Object.assign(globalThis, { document: previousDocument, window: previousWindow });
  }
});

test('extra dictionary meanings expand and collapse without hiding Save Word', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const body = new FakeElement('body');
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => { const node = new FakeElement('#text'); node.textContent = text; return node; },
      addEventListener() {}, removeEventListener() {},
    },
    window: { innerWidth: 800, innerHeight: 600 },
  });
  try {
    const popup = new WordPopup();
    const meanings = Array.from({ length: 20 }, (_, index) => `meaning ${index + 1}`);
    popup.show(
      { expression: '開ける', reading: 'あける', meanings, partOfSpeech: ['verb'] },
      '開ける', 200, 120, false, 'N5',
      { isSaved: false, pending: false, error: null, onToggle() {} },
    );
    const root = body.children[0];
    let toggle = root.find('ja-word-popup-meanings-toggle')!;
    assert.equal(toggle.textContent, '+ 14 more');
    assert.equal(toggle.attributes['aria-expanded'], 'false');
    assert.equal(root.find('ja-word-popup-bookmark')?.textContent, '☆Save Word');

    toggle.listeners.get('click')?.();
    assert.match(root.find('ja-word-popup-meanings')?.textContent ?? '', /meaning 20/);
    toggle = root.find('ja-word-popup-meanings-toggle')!;
    assert.equal(toggle.textContent, 'Show fewer');
    assert.equal(toggle.attributes['aria-expanded'], 'true');
    assert.equal(root.find('ja-word-popup-bookmark')?.textContent, '☆Save Word');

    toggle.listeners.get('click')?.();
    assert.doesNotMatch(root.find('ja-word-popup-meanings')?.textContent ?? '', /meaning 20/);
    popup.destroy();
  } finally {
    Object.assign(globalThis, { document: previousDocument, window: previousWindow });
  }
});

test('rapid Save clicks persist one stable token snapshot without a dictionary entry', async () => {
  const pending = deferred();
  const savedDrafts: any[] = [];
  const vocabulary = {
    isSaved: async () => false,
    save: (draft: object) => { savedDrafts.push(draft); return pending.promise.then(() => ({ id: 'saved' })); },
    remove: async () => undefined,
    subscribe: () => () => {},
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    { isLoaded: () => true, lookup: () => null },
    '未知語', '未知語', '', vocabulary,
  );
  renderer.handleTokenClick({ target: clickedToken('未知語', '未知語', '') });
  await Promise.resolve();
  const toggle = calls.at(-1)?.bookmark.onToggle;
  toggle();
  calls.at(-1)?.bookmark.onToggle();

  assert.equal(savedDrafts.length, 1);
  assert.deepEqual(savedDrafts[0].meanings, []);
  assert.equal(savedDrafts[0].jlptLevel, null);
  assert.equal(savedDrafts[0].surface, '未知語');
  pending.resolve();
  await pending.promise;
  await Promise.resolve();
  assert.equal(calls.at(-1)?.bookmark.isSaved, true);
  assert.equal(calls.at(-1)?.bookmark.pending, false);
});

test('external saved-state synchronization enables removal from the same popup', async () => {
  const removed: string[] = [];
  const vocabulary = {
    isSaved: async () => false,
    save: async () => ({ id: 'unused' }),
    remove: async (id: string) => { removed.push(id); },
    subscribe: () => () => {},
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => ({ expression: '学生', reading: 'がくせい', meanings: ['student'] }) },
    { isLoaded: () => true, lookup: () => 'N5' },
    '学生', '学生', 'ガクセイ', vocabulary,
  );
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  await Promise.resolve();
  const identity = createVocabularyIdentity({ expression: '学生', reading: 'がくせい', surface: '学生' });
  renderer.refreshActiveBookmark([{
    id: identity.id,
    expression: '学生', reading: 'がくせい', baseForm: '学生', surface: '学生',
    meanings: ['student'], partOfSpeech: [], jlptLevel: 'N5',
    createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
  }], null);
  assert.equal(calls.at(-1)?.bookmark.isSaved, true);
  calls.at(-1)?.bookmark.onToggle();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(removed, [identity.id]);
  assert.equal(calls.at(-1)?.bookmark.isSaved, false);
});

test('save uses the source snapshot captured when the token was clicked', async () => {
  let savedDraft: any;
  const vocabulary = {
    isSaved: async () => false,
    save: async (draft: object) => { savedDraft = draft; return { id: 'saved' }; },
    remove: async () => undefined,
    subscribe: () => () => {},
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    { isLoaded: () => true, lookup: () => 'N5' },
    '学生', '学生', 'ガクセイ', vocabulary,
  );
  renderer.playerObserver.getVocabularySource = () => ({
    videoId: 'dQw4w9WgXcQ', videoTitle: 'Lesson', timestamp: 42, subtitleText: '学生です',
  });
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  await Promise.resolve();
  calls.at(-1)?.bookmark.onToggle();
  await Promise.resolve();
  assert.deepEqual(savedDraft.source, {
    videoId: 'dQw4w9WgXcQ', videoTitle: 'Lesson', timestamp: 42, subtitleText: '学生です',
  });
});

test('bookmark persistence failures remain visible and retryable', async () => {
  const vocabulary = {
    isSaved: async () => false,
    save: async () => { throw new Error('Storage quota exceeded'); },
    remove: async () => undefined,
    subscribe: () => () => {},
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: () => null },
    { isLoaded: () => true, lookup: () => null },
    '未知語', '未知語', '', vocabulary,
  );
  renderer.handleTokenClick({ target: clickedToken('未知語', '未知語', '') });
  await Promise.resolve();
  calls.at(-1)?.bookmark.onToggle();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.at(-1)?.bookmark.pending, false);
  assert.equal(calls.at(-1)?.bookmark.isSaved, false);
  assert.equal(calls.at(-1)?.bookmark.error, 'Storage quota exceeded');
});

test('an older save completion cannot update a newer word popup', async () => {
  const pending = deferred();
  const vocabulary = {
    isSaved: async () => false,
    save: () => pending.promise.then(() => ({ id: 'saved' })),
    remove: async () => undefined,
    subscribe: () => () => {},
  };
  const { renderer, calls } = rendererHarness(
    { isLoaded: () => true, lookup: (word: string) => ({ expression: word, reading: '', meanings: [] }) },
    { isLoaded: () => true, lookup: () => null },
    '学生', '学生', 'ガクセイ', vocabulary,
  );
  renderer.handleTokenClick({ target: clickedToken('学生', '学生', 'ガクセイ') });
  await Promise.resolve();
  calls.at(-1)?.bookmark.onToggle();
  renderer.renderedText = '先生';
  renderer.renderedTokens = [{ surface: '先生', baseForm: '先生', reading: 'センセイ' }];
  renderer.handleTokenClick({ target: clickedToken('先生', '先生', 'センセイ') });
  await Promise.resolve();
  await Promise.resolve();
  const callsBeforeCompletion = calls.length;
  pending.resolve();
  await pending.promise;
  await Promise.resolve();
  assert.equal(calls.length, callsBeforeCompletion);
  assert.equal(calls.at(-1)?.surface, '先生');
  assert.equal(calls.at(-1)?.bookmark.isSaved, false);
});
