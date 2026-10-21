import React, { useState, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { updateLocalProfile } from '../domain/engine';
import { validProfileAvatar } from '../domain/profileAvatar.mjs';
import type { ProfileAvatar as AvatarValue } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { ActionButton, Page, Panel, SectionTitle } from '../ui/components';
import { AppTextInput } from '../ui/AppTextInput';
import {
  ProfileAvatar,
  avatarOptions,
  defaultAvatar,
} from '../ui/ProfileAvatar';
import { useAppTheme } from '../ui/ThemeProvider';
import { useAndroidMountReady } from '../ui/useAndroidMountReady';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { confirmDiscard, ErrorText, useScreenStyles } from './shared';

export function AccountScreen() {
  const { state, run, busy } = useApp();
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const navigation = useNavigation();
  // 账户页控件更多，Android 多等一会再挂正文，避开栈切换竞态。
  const mountReady = useAndroidMountReady(600);
  const profile = state.giftState?.profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState<AvatarValue>(
    profile?.avatar ?? defaultAvatar,
  );
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);
  const pickingRef = useRef(false);
  // 页面保持挂载时保留草稿，切换主题、底栏或时钟刷新都不重置输入。
  // 不用 JSON.stringify 比对整图，避免大图每帧序列化拖垮内存。
  const savedAvatar = profile?.avatar ?? defaultAvatar;
  const dirty =
    name !== (profile?.name ?? '') ||
    avatar.kind !== savedAvatar.kind ||
    (avatar.kind === 'preset' &&
      savedAvatar.kind === 'preset' &&
      avatar.id !== savedAvatar.id) ||
    (avatar.kind === 'image' &&
      savedAvatar.kind === 'image' &&
      avatar.dataUri !== savedAvatar.dataUri);
  usePreventRemove(dirty || busy || picking, ({ data }) => {
    if (!busy && !picking)
      confirmDiscard(
        '放弃未保存的账户资料？',
        '头像与昵称的更改尚未保存。',
        () => navigation.dispatch(data.action),
      );
  });
  async function pickAvatar() {
    if (pickingRef.current || busy) return;
    pickingRef.current = true;
    setPicking(true);
    setError('');
    const temporaryUrls = new Set<string>();
    let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
    let image:
      | Awaited<ReturnType<NonNullable<typeof context>['renderAsync']>>
      | undefined;
    try {
      // 只调用系统选图器，不请求相机或整个相册的读取权限。
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('没有读取到图片，请重新选择。');
      temporaryUrls.add(asset.uri);
      const mime = asset.mimeType?.toLowerCase();
      if (
        (mime &&
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
          ].includes(mime)) ||
        (asset.fileSize !== undefined && asset.fileSize > 10 * 1024 * 1024) ||
        asset.width <= 0 ||
        asset.height <= 0 ||
        asset.width * asset.height > 40_000_000
      )
        throw new Error(
          '请选择不超过10MB、4000万像素的 JPG、PNG、WebP 或 HEIC 静态图片。',
        );
      context = ImageManipulator.manipulate(asset.uri);
      const edge = Math.min(320, Math.min(asset.width, asset.height));
      context
        .crop({
          originX: (asset.width - Math.min(asset.width, asset.height)) / 2,
          originY: (asset.height - Math.min(asset.width, asset.height)) / 2,
          width: Math.min(asset.width, asset.height),
          height: Math.min(asset.width, asset.height),
        })
        .resize({ width: edge, height: edge });
      image = await context.renderAsync();
      if ('uri' in image && typeof image.uri === 'string')
        temporaryUrls.add(image.uri);
      const output = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.75,
        base64: true,
      });
      temporaryUrls.add(output.uri);
      const next: AvatarValue = {
        kind: 'image',
        dataUri: `data:image/jpeg;base64,${output.base64 ?? ''}`,
      };
      if (!validProfileAvatar(next))
        throw new Error('图片处理后仍不符合头像限制，请换一张更小的图片。');
      setAvatar(next);
      setSaved(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '无法读取图片，请重试或选择预设头像。',
      );
    } finally {
      // 最终保存的是data URI；及时释放选图中间对象，避免反复换头像占用内存。
      if (Platform.OS === 'web')
        for (const uri of temporaryUrls)
          if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      image?.release();
      context?.release();
      pickingRef.current = false;
      setPicking(false);
    }
  }
  async function save() {
    if (busy || pickingRef.current) return;
    let id: string;
    try {
      id = profile?.id ?? state.sync?.accountId ?? '';
    } catch {
      setError('无法建立本机身份，请稍后重试。');
      return;
    }
    const result = await run((draft) =>
      updateLocalProfile(draft, { id, name: name.trim(), avatar }),
    );
    setError(result.ok ? '' : result.message);
    if (result.ok) {
      setName(name.trim());
      setSaved(true);
    }
  }
  return (
    <Page title="账户资料" subtitle="仅本机资料，尚未登录云账户。">
      {!mountReady ? (
        <Panel>
          <View collapsable={false} style={{ minHeight: 120 }} />
        </Panel>
      ) : (
        <View collapsable={false}>
          <Panel>
            <Text style={styles.muted}>
              头像和昵称只保存在此设备，不会同步。赠券与这里共用昵称；已发出券和领取回执保留当时的称呼，修改后只影响新的记录。头像不会放进券码或回执。
            </Text>
          </Panel>
          <Panel>
            <SectionTitle title="我的头像" />
            <View style={{ alignItems: 'center', gap: 8 }}>
              <ProfileAvatar avatar={avatar} size={72} />
              <Text style={styles.muted}>
                {avatar.kind === 'image'
                  ? '已选择相册图片'
                  : `当前：${avatarOptions.find((item) => item.id === avatar.id)?.name}`}
              </Text>
            </View>
            <View style={styles.actions} accessibilityRole="radiogroup">
              {avatarOptions.map((item) => {
                const selected =
                  avatar.kind === 'preset' && avatar.id === item.id;
                return (
                  <AvatarChoice
                    key={item.id}
                    icon={item.icon}
                    label={item.name + (selected ? ' · 已选' : '')}
                    selected={selected}
                    disabled={busy || picking}
                    color={colors.primary}
                    fill={
                      selected ? colors.primaryContainer : colors.field
                    }
                    onPress={() => {
                      setAvatar({ kind: 'preset', id: item.id });
                      setSaved(false);
                    }}
                  />
                );
              })}
            </View>
            <ActionButton
              icon="image-outline"
              disabled={busy || picking}
              loading={picking}
              onPress={() => {
                void pickAvatar();
              }}
            >
              从相册选择
            </ActionButton>
            <Text style={styles.muted}>
              支持不超过10MB的静态图片；居中裁成方形并压缩至320像素、200KB以内。取消选择会保留当前草稿。
            </Text>
          </Panel>
          <Panel>
            <SectionTitle title="昵称" />
            <AppTextInput
              label="昵称（1–20字）"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setSaved(false);
              }}
              maxLength={20}
              disabled={busy || picking}
            />
            {profile && (
              <Text
                selectable={Platform.OS !== 'android'}
                style={styles.muted}
              >
                本机身份编号（不可修改）：{profile.id}
              </Text>
            )}
            <ErrorText message={error} />
            {saved && (
              <Text accessibilityLiveRegion="polite" style={styles.muted}>
                账户资料已保存到本机。
              </Text>
            )}
            <ActionButton
              tone="save"
              mode="contained"
              disabled={
                busy || picking || !name.trim() || (!dirty && !!profile)
              }
              loading={busy}
              onPress={() => {
                void save();
              }}
            >
              保存资料
            </ActionButton>
          </Panel>
        </View>
      )}
    </Page>
  );
}

function AvatarChoice({
  icon,
  label,
  selected,
  disabled,
  color,
  fill,
  onPress,
}: {
  icon: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  color: string;
  fill: string;
  onPress: () => void;
}) {
  const focus = useKeyboardFocus();
  // Android 不用 Paper TouchableRipple / radio，降低进页原生无障碍竞态。
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        minHeight: 40,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: fill,
        opacity: disabled ? 0.5 : 1,
        ...(Platform.OS === 'web'
          ? {
              outlineWidth: focus.focusVisible ? 2 : 0,
              outlineStyle: 'solid' as const,
              outlineColor: color,
              outlineOffset: -2,
            }
          : null),
      }}
    >
      <Icon source={icon} size={18} color={color} />
      <Text style={{ fontSize: 12, lineHeight: 18, color }}>{label}</Text>
    </Pressable>
  );
}
