import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View, useWindowDimensions } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  StackActions,
  type LinkingOptions,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomNavigation,
  Icon,
  PaperProvider,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AppProvider, useApp } from './src/state/AppProvider';
import {
  ArchivedScreen,
  AccountScreen,
  GrowthScreen,
  GiftsScreen,
  MilestonesScreen,
  MoreScreen,
  SettingsScreen,
  TicketsScreen,
  TodayScreen,
  GroupScreen,
  MemberScreen,
  type MoreRoute,
} from './src/screens';
import { GroupViewProvider } from './src/ui/GroupViewProvider';
import { ThemeProvider, useAppTheme } from './src/ui/ThemeProvider';

type MoreStackParams = {
  index: undefined;
  milestones: undefined;
  growth: undefined;
  archived: undefined;
  settings: undefined;
  gifts: undefined;
  account: undefined;
  group: undefined;
  member: { accountId: string; date?: string };
};
type TabsParams = {
  today: undefined;
  tickets: { intent?: 'own-available'; at?: number } | undefined;
  more: NavigatorScreenParams<MoreStackParams> | undefined;
};
const Tabs = createBottomTabNavigator<TabsParams>();
const Stack = createNativeStackNavigator<MoreStackParams>();
const tabIcons: Record<string, string> = {
  today: 'check-circle-outline',
  tickets: 'ticket-outline',
  more: 'dots-grid',
};
const tabLabels: Record<string, string> = {
  today: '今日打卡',
  tickets: '我的奖券',
  more: '更多',
};
const linking: LinkingOptions<TabsParams> = {
  prefixes: [Linking.createURL('/'), 'sprout://'],
  config: {
    screens: {
      today: 'today',
      tickets: 'tickets',
      more: {
        path: 'more',
        initialRouteName: 'index',
        screens: {
          index: '',
          milestones: 'milestones',
          growth: 'growth',
          archived: 'archived',
          settings: 'settings',
          gifts: 'gifts',
          account: 'account',
          group: 'group',
          member: 'member/:accountId',
        },
      },
    },
  },
};
function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const bottomInset = insets.bottom + 12;
  return (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={{ ...insets, bottom: bottomInset }}
      shifting={false}
      labeled
      labelMaxFontSizeMultiplier={1.5}
      style={{
        height:
          64 + Math.max(0, Math.min(fontScale, 1.5) - 1) * 32 + bottomInset,
        backgroundColor: colors.surface,
      }}
      activeColor={colors.primary}
      inactiveColor={colors.muted}
      getLabelText={({ route }) => tabLabels[route.name]}
      getAccessibilityLabel={({ route }) => tabLabels[route.name]}
      renderIcon={({ route, color }) => (
        <Icon source={tabIcons[route.name]} color={color} size={22} />
      )}
      onTabPress={({ route, preventDefault }) => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
          data: { behavior: { popToTop: false, scrollToTop: true } },
        });
        if (event.defaultPrevented) preventDefault();
        else if (route.name === 'more') {
          navigation.navigate('more');
          // 正常派发退栈动作，让未保存设置的离开确认继续生效。
          const nested = state.routes.find(
            (item) => item.key === route.key,
          )?.state;
          if (nested?.key && (nested.index ?? 0) > 0) {
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: nested.key,
            });
          }
        } else navigation.navigate(route.name);
      }}
      onTabLongPress={({ route }) =>
        navigation.emit({ type: 'tabLongPress', target: route.key })
      }
    />
  );
}
function MoreNavigator() {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator
      initialRouteName="index"
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 16 },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.background },
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }}>
        {({ navigation }) => (
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <MoreScreen
              onNavigate={(route: MoreRoute) => navigation.navigate(route)}
            />
          </SafeAreaView>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="milestones"
        component={MilestonesScreen}
        options={{ title: '里程碑' }}
      />
      <Stack.Screen
        name="growth"
        component={GrowthScreen}
        options={{ title: '成长记录' }}
      />
      <Stack.Screen
        name="archived"
        component={ArchivedScreen}
        options={{ title: '已归档任务' }}
      />
      <Stack.Screen
        name="gifts"
        component={GiftsScreen}
        options={{ title: '赠送与领取' }}
      />
      <Stack.Screen
        name="account"
        component={AccountScreen}
        options={{ title: '账户资料' }}
      />
      <Stack.Screen
        name="settings"
        component={SettingsScreen}
        options={{ title: '设置' }}
      />
      <Stack.Screen
        name="group"
        component={GroupScreen}
        options={{ title: '小组' }}
      />
      <Stack.Screen
        name="member"
        component={MemberScreen}
        options={{ title: '成员记录' }}
      />
    </Stack.Navigator>
  );
}
function TodayRoute() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <TodayScreen />
    </SafeAreaView>
  );
}
function TicketsRoute() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <TicketsScreen />
    </SafeAreaView>
  );
}
function Navigation() {
  const { colors } = useAppTheme();
  const { message, clearMessage } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView
        edges={['left', 'right']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <NavigationContainer
          linking={linking}
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.surface,
              text: colors.ink,
              border: colors.border,
            },
          }}
        >
          <Tabs.Navigator
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{
              headerShown: false,
              animation: 'none',
              sceneStyle: { backgroundColor: colors.background },
            }}
          >
            <Tabs.Screen name="today" component={TodayRoute} />
            <Tabs.Screen name="tickets" component={TicketsRoute} />
            <Tabs.Screen name="more" component={MoreNavigator} />
          </Tabs.Navigator>
        </NavigationContainer>
      </SafeAreaView>
      <Snackbar
        visible={!!message}
        onDismiss={clearMessage}
        duration={4000}
        action={{ label: '知道了', onPress: clearMessage }}
        style={{ marginBottom: 96 }}
        accessibilityLiveRegion="polite"
      >
        {message}
      </Snackbar>
    </View>
  );
}
function ThemedApp() {
  const { theme } = useAppTheme();
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => listener.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={{ ...theme, animation: { scale: reducedMotion ? 0 : 1 } }}
        settings={{
          icon: ({ name, color, size, testID }) => (
            <MaterialCommunityIcons
              name={
                name as React.ComponentProps<
                  typeof MaterialCommunityIcons
                >['name']
              }
              color={color}
              size={size}
              testID={testID}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ),
        }}
      >
        <StatusBar style="dark" />
        <AppProvider>
          <GroupViewProvider>
            <Navigation />
          </GroupViewProvider>
        </AppProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
