import React, { useState } from 'react';
import {
  parseGiftReceipt,
  previewGift,
  receiveGift,
  recordGiftReceipt,
} from '../domain/engine';
import type { GiftEnvelope, GiftReceipt } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { formatTicketExpiry } from '../ui/ticketLabels';
import { Confirm, formatDate } from './shared';

export function useGiftClaim(setError: (message: string) => void) {
  const { state, run, busy } = useApp();
  const [code, setCode] = useState('');
  const [incoming, setIncoming] = useState<GiftEnvelope | null>(null);
  const [incomingReceipt, setIncomingReceipt] = useState<GiftReceipt | null>(
    null,
  );
  const [receivedMessage, setReceivedMessage] = useState('');

  function preview(raw = code) {
    setCode(raw);
    setReceivedMessage('');
    setIncomingReceipt(null);
    try {
      const receipt = parseGiftReceipt(raw);
      setIncomingReceipt(receipt);
      setIncoming(null);
      setError('');
      return;
    } catch {
      /* 不是回执时继续按赠券校验，详细错误由预览返回。 */
    }
    const result = previewGift(state, raw, new Date());
    if (result.ok && result.gift) {
      setIncoming(result.gift);
      setError('');
    } else {
      setIncoming(null);
      setError(result.message);
    }
  }
  async function receive() {
    if (!incoming) return;
    const result = await run((draft) =>
      receiveGift(draft, incoming, new Date()),
    );
    if (result.ok) {
      setIncoming(null);
      setCode('');
      setError('');
      setReceivedMessage('已保存到本机「我的奖券」，可以去使用啦。');
    } else setError(result.message);
  }
  async function confirmReceipt() {
    if (!incomingReceipt) return;
    const result = await run((draft) =>
      recordGiftReceipt(draft, incomingReceipt),
    );
    if (result.ok) {
      setIncomingReceipt(null);
      setCode('');
      setError('');
      setReceivedMessage('对方的领取回执已记录到本机。');
    } else setError(result.message);
  }

  function changeCode(value: string) {
    setCode(value);
    setIncoming(null);
    setIncomingReceipt(null);
  }
  return {
    busy,
    code,
    changeCode,
    preview,
    incoming,
    incomingReceipt,
    receivedMessage,
    closeGift: () => setIncoming(null),
    closeReceipt: () => setIncomingReceipt(null),
    receive,
    confirmReceipt,
  };
}

export function GiftClaimDialogs({
  claim,
  error,
}: {
  claim: ReturnType<typeof useGiftClaim>;
  error: string;
}) {
  const {
    busy,
    incoming,
    incomingReceipt,
    closeGift,
    closeReceipt,
    receive,
    confirmReceipt,
  } = claim;
  return (
    <>
      <Confirm
        visible={!!incoming}
        title="领取赠券？"
        couponRule={
          incoming
            ? {
                cost: '无需消耗奖券',
                condition: `「${incoming.issuer.name}」赠送的「${incoming.name}」 · ${formatTicketExpiry(incoming.expiresAt)}`,
                rules: '确认后奖券保存到我的奖券。同一设备只能领取一次。',
              }
            : undefined
        }
        busy={busy}
        error={error}
        onDismiss={() => {
          if (!busy) closeGift();
        }}
        onConfirm={() => {
          void receive();
        }}
        tone="reward"
      />
      <Confirm
        visible={!!incomingReceipt}
        title="记录领取回执？"
        description={
          incomingReceipt
            ? `「${incomingReceipt.recipient.name}」在 ${formatDate(incomingReceipt.receivedAt)} 领取了「${incomingReceipt.gift.name}」。此操作只把回执记录到本机。`
            : ''
        }
        busy={busy}
        error={error}
        onDismiss={() => {
          if (!busy) closeReceipt();
        }}
        onConfirm={() => {
          void confirmReceipt();
        }}
      />
    </>
  );
}
