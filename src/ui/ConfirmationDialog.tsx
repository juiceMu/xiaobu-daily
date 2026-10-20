import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useAppTheme } from './ThemeProvider';

export function ConfirmationDialog({
  visible,
  title,
  children,
  onDismiss,
  busy = false,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: 'rgba(25, 42, 56, 0.32)' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            testID="confirmation-dialog"
            accessibilityViewIsModal
            accessibilityLabel={title}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '90%',
              flexShrink: 1,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 16,
              gap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 16,
                lineHeight: 22,
                fontWeight: '600',
                color: colors.ink,
              }}
            >
              {title}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
