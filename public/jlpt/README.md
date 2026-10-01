# AIBA JLPT vocabulary asset

`jlpt-vocab.json` is a vocabulary-only transformation of
[OpenJLPT](https://github.com/evanclan/OpenJLPT), version 0.3.0, pinned to immutable
commit `88eaef9c589f787194903e733c7f7b6df9d6ebc0`.

OpenJLPT and this transformed dataset are distributed under CC BY-SA 4.0. See
`LICENSE-OpenJLPT.txt` for the license and `NOTICE-OpenJLPT.md` for upstream
attribution, source details, and the important caveat that JLPT vocabulary levels
are unofficial approximations.

## Transformation

The AIBA asset preserves these OpenJLPT vocabulary fields:

- `id`
- `word`, renamed to `expression`
- `reading`
- `level`
- `other_forms`, when present
- `other_readings`, when present

Meanings, romanization, parts of speech, JMdict identifiers, and example sentences
are omitted because AIBA uses a separate JMdict-derived asset for definitions. No
entries or JLPT levels are inferred. Source order is preserved from N5 through N1.

Alternate forms and alternate readings are retained as separate arrays. AIBA pairs
each alternate form with the primary reading and each alternate reading with the
primary expression. It does not create a Cartesian product between alternate forms
and alternate readings because OpenJLPT does not encode those relationships.

## Rebuilding

Clone and check out the pinned revision, then run:

```text
node scripts/build-jlpt-dataset.mjs --source /path/to/OpenJLPT
```

The script refuses to run against a different commit. It validates the expected
per-level counts and unique source IDs before writing the compact asset, then copies
the upstream license and notice into this directory.
