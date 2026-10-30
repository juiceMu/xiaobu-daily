let lastTicketLandingId = 0;

// 同一毫秒内重复进入也应触发新的页面意图。
export function nextTicketLandingId() {
  lastTicketLandingId = Math.max(Date.now(), lastTicketLandingId + 1);
  return lastTicketLandingId;
}
