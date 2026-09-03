import kuromoji from 'kuromoji';

kuromoji.builder({ dicPath: './node_modules/kuromoji/dict' }).build((err, tokenizer) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const text = '私は日本語を勉強しています。';
  const tokens = tokenizer.tokenize(text);
  
  const mapped = tokens.map(t => ({
    surface: t.surface_form,
    reading: t.reading,
    baseForm: t.basic_form !== '*' ? t.basic_form : t.surface_form,
    partOfSpeech: t.pos
  }));
  
  console.log(JSON.stringify(mapped, null, 2));
});
