// 从用户提供的原图裁去白边，生成原生安装图标；不改变原图。
// Android 自适应前景只放在中心约 66% 安全区，避免圆角/圆形遮罩裁掉「小步」。
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { generateImageAsync } = require('@expo/image-utils');

const BACKGROUND = '#FFFCF1';
const CANVAS = 1024;
// 108dp 画布中 72dp 安全区 ≈ 66.7%；略收一点适配圆形遮罩。
const SAFE_CONTENT = Math.round(CANVAS * 0.64);

function fillBackground(png, hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
}

function nearestScale(source, size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(
        source.width - 1,
        Math.floor((x * source.width) / size),
      );
      const sy = Math.min(
        source.height - 1,
        Math.floor((y * source.height) / size),
      );
      const si = (source.width * sy + sx) << 2;
      const di = (size * y + x) << 2;
      out.data[di] = source.data[si];
      out.data[di + 1] = source.data[si + 1];
      out.data[di + 2] = source.data[si + 2];
      out.data[di + 3] = source.data[si + 3];
    }
  }
  return out;
}

async function writeAdaptiveForeground(fullIconPath, outPath) {
  const full = PNG.sync.read(fs.readFileSync(fullIconPath));
  const scaled = nearestScale(full, SAFE_CONTENT);
  const canvas = new PNG({ width: CANVAS, height: CANVAS });
  fillBackground(canvas, BACKGROUND);
  const offset = Math.floor((CANVAS - SAFE_CONTENT) / 2);
  PNG.bitblt(scaled, canvas, 0, 0, SAFE_CONTENT, SAFE_CONTENT, offset, offset);
  fs.writeFileSync(outPath, PNG.sync.write(canvas));
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('请提供原始 PNG 图片路径');
  const projectRoot = path.resolve(__dirname, '..');
  const target = path.join(projectRoot, 'assets');
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  if (source.width !== 1260 || source.height !== 1244)
    throw new Error('原图尺寸变化，请重新确认裁剪区域');
  fs.mkdirSync(target, { recursive: true });
  const crop = new PNG({ width: 1040, height: 1040 });
  PNG.bitblt(source, crop, 110, 100, 1040, 1040, 0, 0);
  const cropPath = path.join(target, 'icon-cropped.png');
  fs.writeFileSync(cropPath, PNG.sync.write(crop));
  const icon = await generateImageAsync(
    { projectRoot },
    {
      src: cropPath,
      width: CANVAS,
      height: CANVAS,
      resizeMode: 'cover',
      removeTransparency: true,
      backgroundColor: BACKGROUND,
    },
  );
  const iconPath = path.join(target, 'icon.png');
  fs.writeFileSync(iconPath, icon.source);
  await writeAdaptiveForeground(
    iconPath,
    path.join(target, 'adaptive-icon.png'),
  );
  console.log(
    '已生成裁剪原图、1024px 安装图标，以及带安全区内边距的 Android 自适应前景',
  );
}

async function fromCropped() {
  const projectRoot = path.resolve(__dirname, '..');
  const target = path.join(projectRoot, 'assets');
  const cropPath = path.join(target, 'icon-cropped.png');
  if (!fs.existsSync(cropPath)) throw new Error('缺少 assets/icon-cropped.png');
  const icon = await generateImageAsync(
    { projectRoot },
    {
      src: cropPath,
      width: CANVAS,
      height: CANVAS,
      resizeMode: 'cover',
      removeTransparency: true,
      backgroundColor: BACKGROUND,
    },
  );
  const iconPath = path.join(target, 'icon.png');
  fs.writeFileSync(iconPath, icon.source);
  await writeAdaptiveForeground(
    iconPath,
    path.join(target, 'adaptive-icon.png'),
  );
  console.log('已从裁剪图重建安装图标与自适应前景');
}

if (process.argv[2] === '--from-cropped') fromCropped().catch(fail);
else main().catch(fail);

function fail(error) {
  console.error(error);
  process.exitCode = 1;
}
