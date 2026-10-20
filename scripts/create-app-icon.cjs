// 从用户提供的原图裁去白边，生成原生安装图标；不改变原图。
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { generateImageAsync } = require('@expo/image-utils');

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
      width: 1024,
      height: 1024,
      resizeMode: 'cover',
      removeTransparency: true,
      backgroundColor: '#FFFCF1',
    },
  );
  fs.writeFileSync(path.join(target, 'icon.png'), icon.source);
  // 前景铺满画布，避免自适应图标中出现嵌套的小圆角方块。
  fs.writeFileSync(path.join(target, 'adaptive-icon.png'), icon.source);
  console.log('已生成裁剪原图、1024px 安装图标和 Android 自适应前景');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
