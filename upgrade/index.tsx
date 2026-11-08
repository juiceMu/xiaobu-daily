import React from 'react';
import { registerRootComponent } from 'expo';
import App from '../App';

// 仅关闭局域网，沿用原页面、偏好与业务仓库，不初始化测试数据。
function IsolatedUpgradeApp() {
  return <App lanEnabled={false} />;
}

registerRootComponent(IsolatedUpgradeApp);
