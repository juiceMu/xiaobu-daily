import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const app = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
).expo;

test('安装图标配置指向已裁剪的1024像素图标', () => {
  for (const path of [app.icon, app.android.adaptiveIcon.foregroundImage]) {
    const imagePath = new URL(`..${path.slice(1)}`, import.meta.url);
    assert.ok(existsSync(imagePath), `${path}不存在`);
    const image = readFileSync(imagePath);
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), 1024);
    assert.equal(image.readUInt32BE(20), 1024);
  }
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#FFFCF1');
});
