import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from '@zxing/library';
import {
  createInitialState,
  createGift,
  ensureGiftProfile,
  exportGift,
  parseGift,
} from '../src/domain/engine';

// 与二维码组件使用同一个编码器，验证真实黑白矩阵可解码；不替代相机实测。
const require = createRequire(import.meta.url);
const encoder = require('qrcode') as {
  create(
    value: string,
    options: { errorCorrectionLevel: string },
  ): {
    modules: { size: number; data: Uint8Array };
  };
};

test('中文赠券使用实际二维码编码器与扫码解码器完整往返', () => {
  const state = createInitialState();
  const now = new Date('2026-10-20T03:00:00.000Z');
  assert.equal(
    ensureGiftProfile(state, {
      id: 'profile-a1234567',
      name: '小林与家人',
    }).ok,
    true,
  );
  for (const validity of ['week', 'permanent'] as const) {
    const result = createGift(
      state,
      { name: '一起喝奶茶 · 好好休息券', validity },
      { giftId: 'gift-' + validity, ticketId: 'ticket-' + validity },
      now,
    );
    assert.ok(result.gift);
    const payload = exportGift(result.gift);
    const { modules } = encoder.create(payload, { errorCorrectionLevel: 'M' });
    const scale = 4;
    const margin = 4;
    const width = (modules.size + margin * 2) * scale;
    const pixels = new Uint8ClampedArray(width * width).fill(255);
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (!modules.data[y * modules.size + x]) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            pixels[
              ((y + margin) * scale + dy) * width + (x + margin) * scale + dx
            ] = 0;
          }
        }
      }
    }
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(new RGBLuminanceSource(pixels, width, width)),
    );
    const decoded = new QRCodeReader().decode(bitmap).getText();
    assert.equal(decoded, payload);
    assert.deepEqual(parseGift(decoded, now), result.gift);
  }
});
