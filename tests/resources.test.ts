import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditName, iconifySVGURL, iconifySearchURL, openverseSearchURL, parseIconify, parseOpenverse, permissiveLicense, picsumHits } from '../src/resources';

test('Iconify results carry set, license and SVG urls, and non-commercial or copyleft sets are hidden', () => {
  assert.equal(iconifySearchURL(' piano keys ', 500), 'https://api.iconify.design/search?query=piano%20keys&limit=96');
  assert.equal(iconifySVGURL('lucide:music', '#112233'), 'https://api.iconify.design/lucide/music.svg?width=64&height=64&color=%23112233');
  assert.throws(() => iconifySVGURL('../etc:passwd'), /inválido/);
  const hits = parseIconify({ icons: ['lucide:music', 'bad id', 'gpl-set:thing', 'openmoji:piano'], collections: { lucide: { name: 'Lucide', license: { title: 'ISC', spdx: 'ISC', url: 'https://x/l' }, author: { name: 'Lucide Contributors' } }, 'gpl-set': { name: 'GPL set', license: { spdx: 'GPL-3.0' } }, openmoji: { name: 'OpenMoji', license: { spdx: 'CC-BY-SA-4.0' } } } }, '#000');
  assert.deepEqual(hits.map(h => h.id), ['iconify:lucide:music', 'iconify:openmoji:piano']);
  assert.equal(hits[0].set, 'Lucide'); assert.equal(hits[0].license, 'ISC'); assert.equal(hits[0].creator, 'Lucide Contributors'); assert.ok(hits[0].svgUrl!.includes('width=256') && !hits[0].svgUrl!.includes('color='), 'the inserted SVG keeps currentColor'); assert.ok(hits[0].thumb.includes('color=%23000')); assert.ok(parseIconify({ icons: ['lucide:music'], collections: {} })[0].thumb.includes('color=%23d2d2db'));
  assert.equal(creditName(hits[0]), 'music · Lucide Contributors · ISC'); assert.equal(creditName(hits[1]), 'piano · OpenMoji · CC-BY-SA-4.0');
  assert.equal(permissiveLicense('CC-BY-NC-4.0'), false); assert.equal(permissiveLicense('MIT'), true); assert.equal(permissiveLicense('CC BY-SA 2.0'), true);
});

test('Openverse results become credited photo hits served through the Openverse thumbnail proxy', () => {
  assert.equal(openverseSearchURL('piano', 2), 'https://api.openverse.org/v1/images/?q=piano&page=2&page_size=20&license_type=commercial,modification');
  const hits = parseOpenverse({ results: [
    { id: '8b6ca8d7-5310-4af7-83e0-f3b115f94cb3', title: 'piano baru', license: 'by-sa', license_version: '2.0', creator: 'apaan', url: 'https://live.staticflickr.com/x.jpg', thumbnail: 'https://api.openverse.org/v1/images/8b6ca8d7-5310-4af7-83e0-f3b115f94cb3/thumb/', width: 500, height: 375, foreign_landing_url: 'https://www.flickr.com/photos/x' },
    { id: 'not-a-uuid', title: 'x', license: 'by' },
    { id: '60b0398b-cf6a-4e4b-851f-41f34471d875', title: 'Public', license: 'cc0', license_version: '1.0', creator: 'nobody' },
  ] });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].license, 'CC BY-SA 2.0'); assert.equal(hits[0].imageUrl, 'https://api.openverse.org/v1/images/8b6ca8d7-5310-4af7-83e0-f3b115f94cb3/thumb/'); assert.equal(hits[0].page, 'https://www.flickr.com/photos/x');
  assert.equal(creditName(hits[0]), 'piano baru · apaan · CC BY-SA 2.0');
  assert.equal(hits[1].license, 'CC0 1.0');
});

test('Picsum placeholders are deterministic per seed and credited to Unsplash', () => {
  const hits = picsumHits('Sonus Academy!', 3, 480, 320);
  assert.deepEqual(hits.map(h => h.id), ['picsum:sonus-academy-1', 'picsum:sonus-academy-2', 'picsum:sonus-academy-3']);
  assert.equal(hits[0].imageUrl, 'https://picsum.photos/seed/sonus-academy-1/480/320'); assert.equal(hits[0].thumb, 'https://picsum.photos/seed/sonus-academy-1/240/160');
  assert.equal(creditName(hits[0]), 'Foto de relleno 1 · Unsplash vía Picsum · Unsplash License');
  assert.equal(picsumHits('', 100).length, 48);
});
