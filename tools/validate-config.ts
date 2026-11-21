import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  loadSchema: async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Cannot load schema: ' + uri);
    return response.json();
  },
});
addFormats(ajv);
ajv.addFormat('https-url', /^https:\/\//);
const schema = await (
  await fetch('https://developers.reddit.com/schema/config-file.v1.json')
).json();
const validate = await ajv.compileAsync(schema);
if (!validate(JSON.parse(await readFile('devvit.json', 'utf8')))) {
  console.error(validate.errors);
  process.exitCode = 1;
} else
  console.log(
    'Devvit config: valid against official schema (no login required).'
  );
