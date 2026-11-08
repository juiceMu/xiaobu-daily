// 默认关闭；普通入口不注册。按渲染时读取，不能在页面模块加载时缓存。
let acceptanceDemoPreview = false;

export function registerAcceptanceDemoPreview() {
  acceptanceDemoPreview = true;
}

export function isAcceptanceDemoPreviewAllowed() {
  return acceptanceDemoPreview;
}
