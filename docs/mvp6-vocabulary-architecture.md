# MVP 6 Vocabulary Architecture

## Scope and constraints

- Save dictionary vocabulary encountered in YouTube subtitles locally.
- Keep vocabulary independent from subtitle files and subtitle settings.
- Support thousands of entries without storing JMdict or OpenJLPT data.
- Prevent lost updates between the popup and YouTube content-script contexts.
- Remain private and offline, with no server, account, analytics, or runtime network access.
- Establish a versioned bookmark schema without implementing MVP 7 review scheduling.

## Decisions

1. A Manifest V3 background service worker is the single authority for vocabulary reads and mutations. Popup and content contexts use runtime messages; only the worker performs read-modify-write operations.
2. The worker owns one serialized repository queue. This provides ordering across extension contexts, unlike separate module-level queues in the popup and content bundles.
3. `chrome.storage.onChanged` broadcasts committed snapshots to interested UI contexts. It is notification-only and never mutates vocabulary.
4. Vocabulary is stored under `aiba_saved_vocabulary_v1`, separate from `ja_dual_subtitle_state`.
5. The store is an envelope containing `schemaVersion: 1` and an ID-indexed record. This makes duplicate checks inexpensive and leaves room for explicit migrations.
6. Identity comes from one shared function. It uses the canonical dictionary expression plus normalized reading. A known reading distinguishes homographs; when reading is unknown, surface is included conservatively.
7. The first source occurrence is retained for MVP 6. Multiple occurrence history and SRS metadata are deferred.

## Alternatives considered

- Per-context queues were rejected because they cannot coordinate the popup and content script.
- Direct whole-object writes from both contexts were rejected because simultaneous read-modify-write operations can lose entries.
- One storage key per word would reduce write collisions, but complicates versioned snapshots, subscriptions, export, and migrations.

## Error handling

- Runtime messaging and Chrome storage errors are returned as typed failures.
- Invalid or unsupported stored schemas are surfaced rather than silently overwritten.
- Failed mutations leave the previously committed snapshot intact.

## Data flow

`UI context -> runtime message -> background repository queue -> chrome.storage.local -> storage change event -> UI subscribers`
