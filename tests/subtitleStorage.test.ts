import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSubtitleState, onSubtitleStateChange, saveSubtitleState } from '../src/storage/subtitleStorage.ts';

test('old stored settings gain the disabled JLPT default without losing subtitles', async () => {
  const previousChrome = globalThis.chrome;
  const stored = {
    filename: 'lesson.srt',
    subtitles: [{ id: 1, startTime: 0, endTime: 2, text: '学生' }],
    enabled: true,
    settings: { showFurigana: false, textColor: '#abcdef' },
  };
  let listener: ((changes: Record<string, { newValue: unknown }>, area: string) => void) | undefined;
  const chromeMock = {
    storage: {
      local: {
        get(_keys: string[], callback: (result: Record<string, unknown>) => void) {
          callback({ ja_dual_subtitle_state: stored });
        },
        set(value: Record<string, unknown>, callback: () => void) {
          Object.assign(stored, value.ja_dual_subtitle_state);
          callback();
        },
      },
      onChanged: {
        addListener(callback: typeof listener) { listener = callback; },
        removeListener() { listener = undefined; },
      },
    },
  };
  Object.assign(globalThis, { chrome: chromeMock });

  try {
    const migrated = await getSubtitleState();
    assert.equal(migrated.settings.showJLPTColors, false);
    assert.equal(migrated.settings.showFurigana, false);
    assert.equal(migrated.subtitles[0].text, '学生');

    let changedValue: Awaited<ReturnType<typeof getSubtitleState>> | undefined;
    const unsubscribe = onSubtitleStateChange((state) => { changedValue = state; });
    listener?.({ ja_dual_subtitle_state: { newValue: stored } }, 'local');
    assert.equal(changedValue?.settings.showJLPTColors, false);
    unsubscribe();

    const updated = await saveSubtitleState({
      settings: { ...migrated.settings, showJLPTColors: true },
    });
    assert.equal(updated.settings.showJLPTColors, true);
    assert.equal(updated.subtitles[0].text, '学生');
    assert.equal((await getSubtitleState()).settings.showJLPTColors, true);
  } finally {
    Object.assign(globalThis, { chrome: previousChrome });
  }
});
