import { formatTicketExpiry } from '../ui/ticketLabels';
import React, { useState, type ComponentType } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import * as Crypto from 'expo-crypto';
import {
  StackActions,
  useNavigation,
  usePreventRemove,
  type NavigationProp,
} from '@react-navigation/native';
import { createGift, exportGift, exportGiftReceipt } from '../domain/engine';
import type { GiftEnvelope, GiftReceipt } from '../domain/types';
import { useApp } from '../state/AppProvider';
import {
  ActionButton,
  FormModal,
  Page,
  Panel,
  SectionTitle,
} from '../ui/components';
import { AppTextInput } from '../ui/AppTextInput';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { GiftClaimDialogs, useGiftClaim } from './GiftClaimFlow';
import { useAndroidMountReady } from '../ui/useAndroidMountReady';
import { CopyCodeButton } from '../ui/CopyCodeButton';
import { useAppTheme } from '../ui/ThemeProvider';
import {
  Confirm,
  CouponRuleDetails,
  confirmDiscard,
  ErrorText,
  formatDate,
  useScreenStyles,
} from './shared';

export function GiftsScreen() {
  const { state, run, busy } = useApp();
  const styles = useScreenStyles();
  const { colors } = useAppTheme();
  const giftRowStyle = {
    borderColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  };
  const navigation = useNavigation<NavigationProp<{ account: undefined }>>();
  const mountReady = useAndroidMountReady();
  const profile = state.giftState?.profile;
  const [savedGiftName, setSavedGiftName] = useState(
    () => state.giftState?.outgoing.at(-1)?.name ?? '心意券',
  );
  const [giftName, setGiftName] = useState(savedGiftName);
  const [validity, setValidity] = useState<'week' | 'permanent'>('week');
  const [error, setError] = useState('');
  const claim = useGiftClaim(setError);
  const { code, preview, changeCode, receivedMessage } = claim;
  const [QrView, setQrView] = useState<ComponentType<{
    value: string;
  }> | null>(null);
  const [selected, setSelected] = useState<GiftEnvelope | null>(null);
  const [receiptQr, setReceiptQr] = useState<GiftReceipt | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const dirty = giftName !== savedGiftName || !!code;
  usePreventRemove(dirty || busy, ({ data }) => {
    if (!busy)
      confirmDiscard(
        '放弃未保存的内容？',
        '尚未制作或领取的内容不会保留。',
        () => navigation.dispatch(data.action),
      );
  });
  async function ensureQr() {
    if (QrView) return;
    const module = await import('../ui/GiftQrCode');
    setQrView(() => module.GiftQrCode);
  }
  async function makeGift() {
    let giftId: string, ticketId: string;
    try {
      giftId = Crypto.randomUUID();
      ticketId = Crypto.randomUUID();
    } catch {
      setError('暂时无法制作，请稍后重试。');
      return;
    }
    const result = await run((draft) =>
      createGift(
        draft,
        { name: giftName.trim(), validity },
        { giftId, ticketId },
        new Date(),
      ),
    );
    if (result.ok && result.gift) {
      await ensureQr();
      setConfirmCreate(false);
      setGiftName(result.gift.name);
      setSavedGiftName(result.gift.name);
      setSelected(result.gift);
      setError('');
    } else setError(result.message);
  }
  return (
    <Page
      title="把心意，做成一张券"
      subtitle="制作新心意券，不消耗或转移已有奖励券。"
    >
      {!mountReady ? (
        <Panel>
          <View collapsable={false} style={{ minHeight: 120 }} />
        </Panel>
      ) : (
        <>
          <Panel>
            <Text style={styles.muted}>
              请把券码只发给想赠送的人。同一个码在不同设备上可能被重复领取。发送和领取记录只保存在当前设备。领取前请与赠送人确认券码。
            </Text>
          </Panel>
          <Panel>
            <SectionTitle title="我的本地身份" />
            <View style={styles.row}>
              <ProfileAvatar avatar={profile?.avatar} size={40} />
              <Text style={styles.heading}>
                {profile?.name ?? '尚未设置昵称'}
              </Text>
            </View>
            {profile && (
              <Text selectable={Platform.OS !== 'android'} style={styles.muted}>
                身份编号：{profile.id}
              </Text>
            )}
            <ActionButton
              tone="save"
              mode="contained"
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                navigation.navigate('account');
              }}
            >
              {profile ? '编辑账户资料' : '设置头像和昵称'}
            </ActionButton>
          </Panel>
          <Panel>
            <SectionTitle title="制作赠券" />
            <AppTextInput
              label="券名（1–30字）"
              value={giftName}
              onChangeText={setGiftName}
              maxLength={30}
              disabled={busy}
            />
            <View style={styles.actions}>
              {(['week', 'permanent'] as const).map((item) => (
                <ActionButton
                  key={item}
                  mode={validity === item ? 'contained-tonal' : 'text'}
                  accessibilityState={{ selected: validity === item }}
                  onPress={() => setValidity(item)}
                  disabled={busy}
                >
                  {item === 'week' ? '本周有效' : '不设到期'}
                </ActionButton>
              ))}
            </View>
            <Text style={styles.muted}>
              本周券到下周一 00:00
              失效，以制作时的本地时间为准。请先与对方约定这张券能兑换什么。
            </Text>
            <ActionButton
              tone="reward"
              mode="contained"
              icon="gift-outline"
              disabled={busy || !profile || !giftName.trim()}
              onPress={() => {
                setError('');
                setConfirmCreate(true);
              }}
            >
              制作赠券
            </ActionButton>
          </Panel>
          <Panel>
            <SectionTitle title="领取心意 / 记录回执" />
            <ActionButton
              icon="qrcode-scan"
              mode="contained-tonal"
              disabled={!profile || busy}
              onPress={() => navigation.dispatch(StackActions.push('scan'))}
            >
              扫码领取
            </ActionButton>
            <AppTextInput
              label="也可以粘贴完整券码或回执码"
              value={code}
              onChangeText={changeCode}
              multiline
              disabled={busy}
              style={{ minHeight: 88 }}
            />
            <ActionButton
              disabled={!profile || !code.trim() || busy}
              onPress={() => preview()}
            >
              预览并领取
            </ActionButton>
            {!!receivedMessage && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {receivedMessage}
              </Text>
            )}
            {!profile && (
              <Text style={styles.muted}>
                先在账户资料保存昵称并建立本地身份，再制作或领取赠券。
              </Text>
            )}
          </Panel>
          <ErrorText message={error} />
          <Panel>
            <SectionTitle title="本机发出" />
            {(state.giftState?.outgoing ?? [])
              .slice()
              .reverse()
              .map((gift, index, gifts) => (
                <View
                  key={gift.giftId}
                  style={[
                    styles.row,
                    giftRowStyle,
                    index === gifts.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.grow}>
                    <Text style={styles.heading}>{gift.name}</Text>
                    <Text style={styles.muted}>
                      已制作 · {formatDate(gift.issuedAt)} ·{' '}
                      {formatTicketExpiry(gift.expiresAt)}
                    </Text>
                    {(state.giftState?.receipts ?? [])
                      .filter((receipt) => receipt.giftId === gift.giftId)
                      .map((receipt) => (
                        <Text key={receipt.recipient.id} style={styles.muted}>
                          本机已记录 {receipt.recipient.name} 的领取回执
                        </Text>
                      ))}
                  </View>
                  <ActionButton
                    onPress={() => {
                      void ensureQr().then(() => setSelected(gift));
                    }}
                  >
                    查看券码
                  </ActionButton>
                </View>
              ))}
            {!state.giftState?.outgoing.length && (
              <Text style={styles.muted}>
                还没有制作赠券。制作后可随时回来展示二维码。
              </Text>
            )}
          </Panel>
          <Panel>
            <SectionTitle title="本机收到" />
            {(state.giftState?.received ?? [])
              .slice()
              .reverse()
              .map((receipt, index, receipts) => (
                <View
                  key={receipt.giftId}
                  style={[
                    styles.row,
                    giftRowStyle,
                    index === receipts.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.grow}>
                    <Text style={styles.heading}>
                      {state.tickets.find(
                        (ticket) => ticket.id === receipt.ticketId,
                      )?.name ?? '收到的心意券'}
                    </Text>
                    <Text style={styles.muted}>
                      本机已领取 · {formatDate(receipt.receivedAt)} ·{' '}
                      {formatTicketExpiry(receipt.gift.expiresAt)}
                    </Text>
                  </View>
                  <ActionButton
                    onPress={() => {
                      void ensureQr().then(() => setReceiptQr(receipt));
                    }}
                  >
                    出示回执
                  </ActionButton>
                </View>
              ))}
            {!state.giftState?.received.length && (
              <Text style={styles.muted}>
                扫码或粘贴券码后，先预览再确认领取。
              </Text>
            )}
          </Panel>
          <GiftClaimDialogs claim={claim} error={error} />
          <FormModal
            visible={!!receiptQr}
            title="请赠送方扫描回执"
            onDismiss={() => setReceiptQr(null)}
          >
            {receiptQr && (
              <View style={styles.form}>
                <Text style={styles.heading}>{receiptQr.gift.name}</Text>
                {QrView ? (
                  <QrView value={exportGiftReceipt(receiptQr)} />
                ) : null}
                <Text style={styles.muted}>
                  请赠送方打开「赠送与领取」扫码记录。回执只表示本机领取记录，没有防伪认证，也不是云端唯一凭证。
                </Text>
                <CopyCodeButton
                  value={exportGiftReceipt(receiptQr)}
                  label="回执码"
                />
                <Text
                  selectable={Platform.OS !== 'android'}
                  style={styles.muted}
                >
                  {exportGiftReceipt(receiptQr)}
                </Text>
              </View>
            )}
          </FormModal>
          <Confirm
            visible={confirmCreate}
            title="制作赠券？"
            details={
              <CouponRuleDetails
                cost="无需消耗已有奖券"
                condition={`「${giftName}」 · ${validity === 'week' ? '本周有效' : '不设到期'}`}
                rules="请只将券码给你想赠送的人。发出后，对方可扫码或粘贴券码领取。"
              />
            }
            busy={busy}
            error={error}
            onDismiss={() => {
              if (!busy) setConfirmCreate(false);
            }}
            onConfirm={() => {
              void makeGift();
            }}
            tone="reward"
          />
          <FormModal
            visible={!!selected}
            title="让对方扫码领取"
            onDismiss={() => setSelected(null)}
          >
            {selected && (
              <View style={styles.form}>
                <Text style={styles.heading}>{selected.name}</Text>
                <Text style={styles.muted}>
                  来自 {selected.issuer.name} ·{' '}
                  {formatTicketExpiry(selected.expiresAt)}
                </Text>
                {QrView ? <QrView value={exportGift(selected)} /> : null}
                <Text style={styles.muted}>
                  已制作并保存在本机；展示二维码不代表对方已经领取。同一个券码可能被多台设备领取，请勿公开分享。
                </Text>
                <CopyCodeButton value={exportGift(selected)} label="券码" />
                <Text
                  selectable={Platform.OS !== 'android'}
                  style={styles.muted}
                >
                  {exportGift(selected)}
                </Text>
                <Text style={styles.muted}>
                  相机不便使用时，点击「复制券码」后粘贴发送给对方。
                </Text>
              </View>
            )}
          </FormModal>
        </>
      )}
    </Page>
  );
}
