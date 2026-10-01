import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OverlayRenderer } from '../src/content/overlayRenderer.ts';
import type { JapaneseToken } from '../src/japanese/types.ts';
import type { SubtitleSettings } from '../src/types/subtitle.ts';

class FakeElement {
  public children: FakeElement[] = [];
  public parentElement: FakeElement | null = null;
  public id = '';
  public className = '';
  public dataset: Record<string, string> = {};
  public style: Record<string, any> = {
    display: '',
    setProperty(name: string, value: string) {
      this[name] = value;
      if (name === 'display') this.display = value;
    },
  };
  public listeners = new Map<string, Function>();
  private ownText = '';
  public tagName: string;

  constructor(tagName: string) { this.tagName = tagName.toUpperCase(); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  appendChild(child: FakeElement) { child.parentElement = this; this.children.push(child); return child; }
  removeChild(child: FakeElement) { this.children.splice(this.children.indexOf(child), 1); child.parentElement = null; return child; }
  replaceChildren(fragment: FakeElement) {
    this.ownText = '';
    this.children = fragment.tagName === '#FRAGMENT' ? [...fragment.children] : [fragment];
    this.children.forEach((child) => { child.parentElement = this; });
  }
  contains(target: FakeElement): boolean { return this === target || this.children.some((child) => child.contains(target)); }
  addEventListener(type: string, handler: Function) { this.listeners.set(type, handler); }
}

const settings: SubtitleSettings = {
  position: 'bottom', fontSize: 26, fontFamily: 'sans-serif', textColor: '#ffffff',
  backgroundColor: '#000000', backgroundOpacity: 0.8, textOutline: true,
  outlineSize: 2, lineSpacing: 1.4, offset: 0, showFurigana: true,
  showJLPTColors: true,
};

function token(surface: string, level: JapaneseToken['jlptLevel'], reading = '', pos = '名詞'): JapaneseToken {
  return { surface, reading, baseForm: surface, partOfSpeech: pos, startIndex: 0, endIndex: surface.length, jlptLevel: level };
}

test('rendering handles level indicators, furigana, unknown words, punctuation, and the toggle', () => {
  const previousDocument = globalThis.document;
  const head = new FakeElement('head');
  Object.assign(globalThis, {
    document: {
      head,
      getElementById: () => null,
      createElement: (tag: string) => new FakeElement(tag),
      createDocumentFragment: () => new FakeElement('#fragment'),
    },
  });

  try {
    const container = new FakeElement('div');
    const renderer = new OverlayRenderer();
    renderer.mount(container as unknown as HTMLElement);
    const overlay = container.children[0];
    const tokens = [
      token('学生', 'N5', 'ガクセイ'),
      token('未知語', null),
      token('。', null, '', '記号'),
      token('<img>', 'N4'),
    ];

    renderer.renderTokens(tokens, true, settings);
    assert.equal(overlay.children[0].tagName, 'RUBY');
    assert.equal(overlay.children[0].dataset.jlpt, 'N5');
    assert.equal(overlay.children[0].style['--ja-jlpt-color'], '#4CAF50');
    assert.equal(overlay.children[0].children[1].tagName, 'RT');
    assert.equal(overlay.children[0].children[1].textContent, 'がくせい');
    assert.equal(overlay.children[0].children[1].dataset.jlpt, undefined);
    assert.equal(overlay.children[1].dataset.jlpt, undefined);
    assert.equal(overlay.children[2].className, 'ja-punct');
    assert.equal(overlay.children[3].children[0].textContent, '<img>');
    assert.equal(overlay.children[3].children.length, 1);
    assert.equal(overlay.listeners.has('click'), true);
    assert.match(head.children[0].textContent, /\.ja-token:hover/);

    const previousWordNode = overlay.children[0];
    renderer.renderTokens(tokens, true, settings);
    assert.equal(overlay.children[0], previousWordNode);

    renderer.renderTokens(tokens, true, { ...settings, showJLPTColors: false });
    assert.equal(overlay.children[0].dataset.jlpt, undefined);
    assert.equal(overlay.children[0].children[1].textContent, 'がくせい');
    renderer.destroy();
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});
