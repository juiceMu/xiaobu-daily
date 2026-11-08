import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import ts from 'typescript';

for (const entry of [
  'index.ts',
  'acceptance/index.tsx',
  'acceptance/fresh.tsx',
  'acceptance/scenario.tsx',
  'fixture/index.tsx',
  'upgrade/index.tsx',
  'peerProtection/index.tsx',
]) {
  test(`${entry}的依赖图隔离夹具、验收控制与升级入口`, () => {
    const root = resolve(import.meta.dirname, '..');
    const pending = [resolve(root, entry)];
    const visited = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      if (entry !== 'peerProtection/index.tsx')
        assert.ok(
          !file.startsWith(resolve(root, 'peerProtection') + sep),
          file,
        );
      if (entry !== 'upgrade/index.tsx')
        assert.ok(!file.startsWith(resolve(root, 'upgrade') + sep), file);
      if (entry !== 'fixture/index.tsx')
        assert.ok(!file.startsWith(resolve(root, 'fixture') + sep), file);
      if (!entry.startsWith('acceptance/'))
        assert.ok(!file.startsWith(resolve(root, 'acceptance') + sep), file);
      const imports = ts.preProcessFile(
        readFileSync(file, 'utf8'),
      ).importedFiles;
      for (const { fileName } of imports) {
        if (!fileName.startsWith('.')) continue;
        const target = resolve(dirname(file), fileName);
        const dependency = [
          target,
          `${target}.ts`,
          `${target}.tsx`,
          `${target}.mjs`,
          resolve(target, 'index.ts'),
          resolve(target, 'index.tsx'),
        ].find(
          (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
        );
        assert.ok(dependency, `本地依赖未解析：${fileName}`);
        pending.push(dependency);
      }
    }
    assert.ok(visited.has(resolve(root, 'src/state/groupViewStorage.ts')));
    assert.ok(visited.has(resolve(root, 'src/ui/DemoHistoryPanel.tsx')));
  });
}
