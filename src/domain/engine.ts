// 复用经过网页版本完整回归验证的纯业务核心，原生界面只通过严格类型门面访问。
// 核心不依赖 DOM 或浏览器存储，保持首达去重、兑换成本和旧档校验行为一致。
export * from './types';
export * from './engineCore.mjs';
export * from './giftCore.mjs';
