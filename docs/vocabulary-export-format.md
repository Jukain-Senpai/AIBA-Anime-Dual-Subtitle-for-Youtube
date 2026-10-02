# AIBA Vocabulary Export Format

AIBA MVP 6 exports a UTF-8 JSON document named `aiba-vocabulary-export-YYYY-MM-DD.json`.
Export is entirely local and always includes the complete saved collection, regardless of the active search or JLPT filter.

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-02T00:00:00.000Z",
  "entries": []
}
```

Each item in `entries` follows the version 1 `SavedVocabulary` schema. It contains its stable ID, canonical expression, normalized reading, base and encountered surface forms, meanings, parts of speech, optional JLPT level, optional YouTube source, and created/updated ISO timestamps.

The optional source object contains a validated YouTube video ID, playback timestamp in seconds, and optionally a video title and subtitle text. Review scheduling is intentionally absent; a future schema version can add or associate MVP 7 review metadata through an explicit migration.
