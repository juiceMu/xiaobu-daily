import { createWebRepository } from './webRepository';

// Metro 在浏览器选择本文件，手机端继续使用 SQLite 实现。
export const nativeRepository = createWebRepository(() => {
  if (typeof window === 'undefined')
    throw new Error('当前环境无法访问浏览器本地存储');
  return window.localStorage;
});
