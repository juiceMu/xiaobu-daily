import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { themeOptions } from '../src/ui/themeCatalog';
import { getStateFromPath } from '../node_modules/@react-navigation/core/src/getStateFromPath';
import {
  CommonActions,
  StackActions,
  StackRouter,
} from '@react-navigation/routers';

// 源码 AST 回归只验证结构契约，不代替浏览器点击或真机交互测试。
function sourceFile(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
const today = sourceFile('../src/screens/TodayScreen.tsx');
const app = sourceFile('../App.tsx');
function find<T extends ts.Node>(
  source: ts.Node,
  guard: (node: ts.Node) => node is T,
): T[] {
  const nodes: T[] = [];
  function visit(node: ts.Node) {
    if (guard(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return nodes;
}
function prop(node: ts.JsxSelfClosingElement, name: string) {
  const value = node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(today) === name,
  )?.initializer;
  assert.ok(value, name + ' 必须显式设置');
  return ts.isJsxExpression(value)
    ? value.expression?.getText(today)
    : value.getText(today);
}
function taskButton(id: string) {
  const matches = find(today, ts.isJsxSelfClosingElement).filter((node) =>
    node.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(today) === 'testID' &&
        attribute.initializer &&
        ts.isStringLiteral(attribute.initializer) &&
        attribute.initializer.text === id,
    ),
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].tagName.getText(today), 'IconButton');
  return matches[0];
}

test('任务操作网页36原生44dp，移除网页hover底色但保留焦点与动态无障碍名称', () => {
  const checkin = taskButton('task-checkin-button');
  const undo = taskButton('task-undo-button');
  for (const button of [checkin, undo, taskButton('task-more-button')]) {
    const style = prop(button, 'style');
    assert.ok(style?.includes('width: taskActionSize'));
    assert.ok(style?.includes('height: taskActionSize'));
    assert.ok(style?.includes('margin: 0'));
    assert.ok(style?.includes("'transparent'"));
    assert.equal(prop(button, 'size'), '18');
    assert.equal(prop(button, 'hitSlop'), '0');
    assert.equal(prop(button, 'rippleColor'), "'transparent'");
    assert.ok(prop(button, 'onFocus')?.includes('setFocusedAction'));
    assert.ok(prop(button, 'onBlur')?.includes('setFocusedAction(null)'));
    assert.ok(style?.includes('focusedAction'));
    assert.ok(style?.includes('keyboardFocus.focusVisible'));
    assert.ok(prop(button, 'onFocus')?.includes('keyboardFocus.onFocus()'));
    assert.ok(prop(button, 'onBlur')?.includes('keyboardFocus.onBlur()'));
    assert.ok(style?.includes('borderColor: colors.primary'));
    assert.ok(prop(button, 'accessibilityLabel')?.includes('item.name'));
    const icon = prop(button, 'icon');
    assert.ok(icon?.includes('width: 28'));
    assert.ok(icon?.includes('height: 28'));
    assert.ok(icon?.includes('borderRadius: 14'));
    assert.ok(prop(button, 'onPressIn')?.includes('setPressedAction'));
    assert.ok(prop(button, 'onPressOut')?.includes('? null : current'));
    assert.ok(prop(button, 'onBlur')?.includes('setPressedAction'));
  }
  assert.ok(
    today.text.includes(
      "const taskActionSize = Platform.OS === 'web' ? 36 : 44",
    ),
  );
  const icon = prop(checkin, 'icon');
  assert.ok(icon?.includes("'check-circle'"));
  assert.match(icon ?? '', /quiet\s*\?\s*'check-all'\s*:\s*'check-circle'/);
  assert.ok(icon?.includes("'checkbox-marked-circle-outline'"));
  assert.equal(icon?.includes("'plus'"), false);
  assert.ok(icon?.includes('width: 28'));
  assert.ok(icon?.includes('height: 28'));
  assert.ok(icon?.includes('size={18}'));
  assert.ok(icon?.includes('color={color}'));
  assert.equal(prop(checkin, 'disabled'), 'busy || complete');
  assert.ok(prop(checkin, 'accessibilityLabel')?.includes('当天已完成'));
  assert.ok(prop(checkin, 'accessibilityLabel')?.includes('，打卡'));
  assert.ok(
    prop(checkin, 'onPress')?.includes(
      'checkIn(draft, item.id, new Date(), selectedDate)',
    ),
  );
  assert.ok(prop(undo, 'icon')?.includes('source="undo-variant"'));
  assert.ok(prop(undo, 'icon')?.includes('size={16}'));
  assert.equal(prop(undo, 'disabled'), 'busy || !count');
  assert.equal(prop(undo, 'onPress'), "() => ask('undo', item)");
  assert.ok(prop(undo, 'accessibilityLabel')?.includes('最近一次打卡'));
});

test('九主题任务三操作实际图标回调在空闲、禁用、完成及按压时透明，仅可用按压降低透明度', () => {
  // 执行真实 JSX 回调表达式，替身只承接元素；不模拟原生渲染或业务存储。
  const React = {
    createElement: (
      type: unknown,
      props: Record<string, unknown>,
      ...children: unknown[]
    ) => ({ type, props, children }),
  };
  for (const option of themeOptions) {
    for (const action of ['checkin', 'undo', 'more']) {
      const button = taskButton('task-' + action + '-button');
      const expression = prop(button, 'icon');
      assert.ok(expression);
      const compiled = ts.transpileModule(
        'const render = ' + expression + ';',
        {
          compilerOptions: {
            jsx: ts.JsxEmit.React,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText;
      for (const busy of [false, true]) {
        for (const complete of [false, true]) {
          for (const count of [0, 1]) {
            for (const pressed of [false, true]) {
              const disabled =
                busy ||
                (action === 'checkin'
                  ? complete
                  : action === 'undo'
                    ? !count
                    : false);
              const render = new Function(
                'React',
                'View',
                'Icon',
                'quiet',
                'colors',
                'busy',
                'complete',
                'count',
                'pressedAction',
                'item',
                compiled + '\nreturn render;',
              )(
                React,
                'View',
                'Icon',
                !!option.quiet,
                option.colors,
                busy,
                complete,
                count,
                pressed ? 'sample-' + action : 'another-action',
                { id: 'sample' },
              );
              const element = render({
                color: disabled ? '#707570' : option.colors.primary,
              });
              const label = `${option.id}/${action}/busy=${busy}/complete=${complete}/count=${count}/pressed=${pressed}`;
              assert.equal(
                element.props.style.backgroundColor,
                'transparent',
                label,
              );
              assert.equal(
                element.props.style.opacity,
                pressed && !disabled ? 0.65 : 1,
                label,
              );
              assert.equal(element.props.style.width, 28, label);
              assert.equal(element.props.style.height, 28, label);
              const icon = element.children[0];
              assert.equal(
                icon.props.color,
                disabled ? '#707570' : option.colors.primary,
                label,
              );
              assert.equal(icon.props.size, action === 'undo' ? 16 : 18, label);
              assert.equal(
                icon.props.source,
                action === 'checkin'
                  ? complete
                    ? option.quiet
                      ? 'check-all'
                      : 'check-circle'
                    : 'checkbox-marked-circle-outline'
                  : action === 'undo'
                    ? 'undo-variant'
                    : 'dots-horizontal',
                label,
              );
            }
          }
        }
      }
      if (action === 'more') {
        assert.equal(prop(button, 'disabled'), 'busy');
        assert.equal(prop(button, 'onPress'), '() => setMenuId(item.id)');
      }
    }
  }
});

test('任务名称进度与三个操作保持同一nowrap横行，不单独创建操作行', () => {
  const checkin = taskButton('task-checkin-button');
  const undo = taskButton('task-undo-button');
  const more = taskButton('task-more-button');
  const group = checkin.parent;
  assert.ok(ts.isJsxElement(group));
  assert.equal(undo.parent, group);
  assert.ok(group.getText(today).includes('task-action-group'));
  assert.ok(group.getText(today).includes('gap: 0'));
  assert.ok(group.getText(today).includes("flexWrap: 'nowrap'"));
  const row = group.parent;
  assert.ok(ts.isJsxElement(row));
  assert.ok(row.getText(today).includes('task-main-row'));
  let parent: ts.Node | undefined = more;
  while (parent && parent !== group) parent = parent.parent;
  assert.equal(parent, group);
  const text = row.getText(today);
  assert.ok(text.includes("flexDirection: 'row'"));
  assert.ok(text.includes("flexWrap: 'nowrap'"));
  assert.ok(text.includes('gap: 8'));
  assert.ok(text.includes('flex: 1, minWidth: 0'));
  assert.ok(text.includes('numberOfLines={1}'));
  assert.ok(text.includes('ellipsizeMode="tail"'));
  assert.ok(text.includes('accessibilityLabel={item.name}'));
  const progress = find(row, ts.isJsxElement).find(
    (node) =>
      node.openingElement.tagName.getText(today) === 'Text' &&
      node.getText(today).includes('{count}/{item.target}次'),
  );
  assert.ok(progress);
  assert.ok(progress.getText(today).includes('numberOfLines={1}'));
  assert.ok(progress.getText(today).includes('ellipsizeMode="tail"'));
  assert.ok(progress.getText(today).includes('已打卡'));
  assert.equal(text.includes('每一步都算数'), false);
  const panel = row.parent;
  assert.ok(ts.isJsxElement(panel));
  assert.equal(panel.openingElement.tagName.getText(today), 'Panel');
  const children = panel.children.filter(
    (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node),
  );
  assert.equal(children.length, 1);
  assert.equal(panel.getText(today).includes('styles.actions'), false);
});

test('更多Tab只在tabPress未取消时显式回到总览，其他Tab保留原导航', () => {
  const bar = find(app, ts.isJsxSelfClosingElement).find(
    (node) => node.tagName.getText(app) === 'BottomNavigation.Bar',
  );
  assert.ok(bar);
  const onPress = bar.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(app) === 'onTabPress',
  )?.initializer;
  assert.ok(onPress && ts.isJsxExpression(onPress) && onPress.expression);
  const branches = find(onPress.expression, ts.isIfStatement);
  const cancellable = branches.find(
    (node) => node.expression.getText(app) === 'event.defaultPrevented',
  );
  assert.ok(cancellable);
  assert.equal(cancellable.thenStatement.getText(app), 'preventDefault();');
  assert.ok(
    cancellable.elseStatement && ts.isIfStatement(cancellable.elseStatement),
  );
  const more = cancellable.elseStatement;
  assert.equal(more.expression.getText(app), "route.name === 'more'");
  const navigation = find(more.thenStatement, ts.isCallExpression);
  assert.equal(navigation[0].expression.getText(app), 'navigation.navigate');
  assert.equal(navigation[0].arguments[0].getText(app), "'more'");
  assert.equal(navigation[0].arguments.length, 1);
  assert.ok(more.thenStatement.getText(app).includes('navigation.dispatch'));
  assert.ok(
    more.thenStatement.getText(app).includes('StackActions.popToTop()'),
  );
  assert.ok(more.thenStatement.getText(app).includes('target: nested.key'));
  assert.ok(more.thenStatement.getText(app).includes('getRootState()?.routes'));
  assert.ok(app.text.includes('ref={navigationRef}'));
  assert.ok(app.text.includes('getRootState={navigationRef.getRootState}'));
  assert.equal(
    more.elseStatement?.getText(app),
    'navigation.navigate(route.name);',
  );
});

test('更多原生子页收紧Android返回键与标题间距但保留原生返回控件', () => {
  assert.ok(
    app.text.includes("{ translateX: Platform.OS === 'android' ? -30 : 0 }"),
  );
  assert.ok(app.text.includes('headerTitle: ({ children, tintColor })'));
  assert.ok(app.text.includes('numberOfLines={1}'));
  assert.ok(app.text.includes("fontWeight: '500'"));
  assert.ok(app.text.includes('headerTitleStyle: { fontSize: 16 }'));
  assert.equal(app.text.includes('headerBackVisible: false'), false);
});

test('冷启动深链的父Tab仍为部分状态时，更多点击使用已水合的实时子栈', () => {
  const bar = find(app, ts.isJsxSelfClosingElement).find(
    (node) => node.tagName.getText(app) === 'BottomNavigation.Bar',
  );
  assert.ok(bar);
  const handler = bar.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(app) === 'onTabPress',
  )?.initializer;
  assert.ok(handler && ts.isJsxExpression(handler) && handler.expression);
  const linking = find(app, ts.isVariableDeclaration).find(
    (node) => node.name.getText(app) === 'linking',
  )?.initializer;
  assert.ok(linking);
  const { config } = new Function(
    'Linking',
    'return (' + linking.getText(app) + ')',
  )({ createURL: () => 'sprout-qa://' }) as {
    config: Parameters<typeof getStateFromPath>[1];
  };
  const partial = getStateFromPath('more/member/qa-missing-member', config)
    ?.routes[0].state;
  assert.ok(partial);
  assert.equal(partial.key, undefined);
  const options = {
    routeNames: ['index', 'member'],
    routeParamList: {},
    routeGetIdList: {},
  };
  const router = StackRouter({ initialRouteName: 'index' });
  let stackState = router.getRehydratedState(
    { ...partial, type: 'stack' },
    options,
  );
  assert.deepEqual(stackState.routes.at(-1)?.params, {
    accountId: 'qa-missing-member',
  });
  const state = { routes: [{ key: 'more-tab', state: partial }] };
  let dispatched = 0;
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => assert.equal(name, 'more'),
    dispatch: (action: Parameters<typeof router.getStateForAction>[1]) => {
      dispatched += 1;
      assert.equal(action.target, stackState.key);
      const next = router.getStateForAction(stackState, action, options);
      assert.ok(next);
      stackState = router.getRehydratedState(next, options);
    },
  };
  const getRootState = () => ({
    routes: [{ key: 'more-tab', state: stackState }],
  });
  const callback = new Function(
    'navigation',
    'state',
    'StackActions',
    'getRootState',
    'return (' + handler.expression.getText(app) + ')',
  )(navigation, state, StackActions, getRootState);
  callback({
    route: { name: 'more', key: 'more-tab' },
    preventDefault: () => assert.fail('tabPress 未取消'),
  });
  assert.equal(dispatched, 1);
  assert.deepEqual(
    stackState.routes.map((route) => route.name),
    ['index'],
  );
});

test('真实StackRouter中更多点击退栈不追加index，取消tabPress不导航也不退栈', () => {
  const bar = find(app, ts.isJsxSelfClosingElement).find(
    (node) => node.tagName.getText(app) === 'BottomNavigation.Bar',
  );
  assert.ok(bar);
  const handler = bar.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(app) === 'onTabPress',
  )?.initializer;
  assert.ok(handler && ts.isJsxExpression(handler) && handler.expression);
  const options = {
    routeNames: ['index', 'milestones', 'growth', 'archived', 'settings'],
    routeParamList: {},
    routeGetIdList: {},
  };
  const router = StackRouter({ initialRouteName: 'index' });
  const initial = router.getInitialState(options);
  const settings = router.getStateForAction(
    initial,
    CommonActions.navigate('settings'),
    options,
  );
  assert.ok(settings);
  assert.deepEqual(
    settings.routes.map((route) => route.name),
    ['index', 'settings'],
  );
  let stackState = router.getRehydratedState(settings, options);
  let cancelled = false;
  let prevented = false;
  const visited: string[] = [];
  const dispatched: { type: string; target?: string }[] = [];
  const navigation = {
    emit: (event: { data?: { behavior?: { popToTop?: boolean } } }) => {
      assert.equal(event.data?.behavior?.popToTop, false);
      return { defaultPrevented: cancelled };
    },
    navigate: (name: string) => {
      visited.push(name);
    },
    dispatch: (
      action: ReturnType<typeof StackActions.popToTop> & { target?: string },
    ) => {
      dispatched.push(action);
      assert.equal(action.target, settings.key);
      const next = router.getStateForAction(stackState, action, options);
      if (next) stackState = router.getRehydratedState(next, options);
    },
  };
  const state = { routes: [{ key: 'more-tab', state: settings }] };
  const callback = new Function(
    'navigation',
    'state',
    'StackActions',
    'getRootState',
    'return (' + handler.expression.getText(app) + ')',
  )(navigation, state, StackActions, () => state) as (event: {
    route: { name: string; key: string };
    preventDefault: () => void;
  }) => void;
  const press = {
    route: { name: 'more', key: 'more-tab' },
    preventDefault: () => {
      prevented = true;
    },
  };
  cancelled = true;
  callback(press);
  assert.equal(prevented, true);
  assert.deepEqual(visited, []);
  assert.equal(dispatched.length, 0);
  assert.deepEqual(
    stackState.routes.map((route) => route.name),
    ['index', 'settings'],
  );
  cancelled = false;
  callback(press);
  assert.deepEqual(visited, ['more']);
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, 'POP_TO_TOP');
  assert.deepEqual(
    stackState.routes.map((route) => route.name),
    ['index'],
  );
  assert.equal(stackState.routes[0].key, initial.routes[0].key);
});

test('更多导航和深链显式设置总览initialRoute，并保留账户与全部历史入口', () => {
  const stack = find(app, ts.isJsxOpeningElement).find(
    (node) => node.tagName.getText(app) === 'Stack.Navigator',
  );
  assert.ok(stack);
  assert.ok(
    stack.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(app) === 'initialRouteName' &&
        attribute.initializer &&
        ts.isStringLiteral(attribute.initializer) &&
        attribute.initializer.text === 'index',
    ),
  );
  const moreConfig = find(app, ts.isPropertyAssignment).find(
    (node) =>
      node.name.getText(app) === 'more' &&
      ts.isObjectLiteralExpression(node.initializer),
  );
  assert.ok(moreConfig && ts.isObjectLiteralExpression(moreConfig.initializer));
  const fields = moreConfig.initializer.properties.filter(
    ts.isPropertyAssignment,
  );
  assert.equal(
    fields
      .find((node) => node.name.getText(app) === 'initialRouteName')
      ?.initializer.getText(app),
    "'index'",
  );
  const screens = fields.find(
    (node) => node.name.getText(app) === 'screens',
  )?.initializer;
  assert.ok(screens && ts.isObjectLiteralExpression(screens));
  assert.deepEqual(
    screens.properties
      .filter(ts.isPropertyAssignment)
      .map((node) => node.name.getText(app)),
    [
      'index',
      'milestones',
      'growth',
      'archived',
      'settings',
      'gifts',
      'account',
      'group',
      'member',
    ],
  );
  const params = find(app, ts.isTypeAliasDeclaration).find(
    (node) => node.name.text === 'TabsParams',
  );
  assert.ok(
    params?.type
      .getText(app)
      .includes('NavigatorScreenParams<MoreStackParams> | undefined'),
  );
});

test('首页成员入口保留更多总览作为初始页，并传递成员和所选日期', () => {
  const memberParams = find(today, ts.isObjectLiteralExpression).find((node) =>
    node.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(today) === 'screen' &&
        property.initializer.getText(today) === "'member'",
    ),
  );
  assert.ok(memberParams);
  const properties = memberParams.properties.filter(ts.isPropertyAssignment);
  assert.equal(
    properties
      .find((property) => property.name.getText(today) === 'initial')
      ?.initializer.getText(today),
    'false',
  );
  const params = properties.find(
    (property) => property.name.getText(today) === 'params',
  )?.initializer;
  assert.ok(params && ts.isObjectLiteralExpression(params));
  assert.deepEqual(
    params.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [
        property.name.getText(today),
        property.initializer.getText(today),
      ]),
    [
      ['accountId', 'peer.accountId'],
      ['date', 'selectedDate'],
    ],
  );
});

test('更多成员栈回总览，并经真实beforeRemove保护草稿', async () => {
  const bar = find(app, ts.isJsxSelfClosingElement).find(
    (node) => node.tagName.getText(app) === 'BottomNavigation.Bar',
  );
  assert.ok(bar);
  const handler = bar.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(app) === 'onTabPress',
  )?.initializer;
  assert.ok(handler && ts.isJsxExpression(handler) && handler.expression);
  const options = {
    routeNames: ['index', 'member', 'settings'],
    routeParamList: {},
    routeGetIdList: {},
  };
  const router = StackRouter({ initialRouteName: 'index' });
  const { shouldPreventRemove } = await import(
    new URL(
      '../node_modules/@react-navigation/core/lib/module/useOnPreventRemove.js',
      import.meta.url,
    ).href
  );
  for (const { names, protectRoot } of [
    { names: ['index', 'member'], protectRoot: false },
    { names: ['member'], protectRoot: false },
    { names: ['member', 'settings'], protectRoot: false },
    { names: ['member', 'settings'], protectRoot: true },
    { names: ['member', 'index', 'settings'], protectRoot: false },
  ]) {
    let stackState = router.getRehydratedState(
      { stale: true, routes: names.map((name) => ({ name })) },
      options,
    );
    const initialKeys = stackState.routes.map((route) => route.key);
    let protectedKey: string | undefined = protectRoot
      ? initialKeys[0]
      : initialKeys.at(-1);
    let intercepted = false;
    let retryAction: Parameters<typeof router.getStateForAction>[1] | undefined;
    const emitter = {
      emit: ({
        target,
        data,
      }: {
        target: string;
        data: { action: unknown };
      }) => {
        if (target === protectedKey) {
          intercepted = true;
          retryAction = data.action as typeof retryAction;
          return { defaultPrevented: true };
        }
        return { defaultPrevented: false };
      },
    };
    const dispatch = (
      action: Parameters<typeof router.getStateForAction>[1],
    ) => {
      const result = router.getStateForAction(stackState, action, options);
      assert.ok(result);
      const next =
        result.stale === false
          ? result
          : router.getRehydratedState(result, options);
      if (
        !shouldPreventRemove(
          emitter,
          {},
          stackState.routes,
          next.routes,
          action,
        )
      ) {
        stackState = next;
      }
    };
    const navigation = {
      emit: () => ({ defaultPrevented: false }),
      navigate: () => {},
      dispatch,
    };
    const state = { routes: [{ key: 'more-tab', state: stackState }] };
    const callback = new Function(
      'navigation',
      'state',
      'StackActions',
      'getRootState',
      'return (' + handler.expression.getText(app) + ')',
    )(navigation, state, StackActions, () => state) as (event: {
      route: { name: string; key: string };
      preventDefault: () => void;
    }) => void;
    callback({
      route: { name: 'more', key: 'more-tab' },
      preventDefault: () => assert.fail('tabPress 未取消'),
    });
    assert.equal(intercepted, true);
    assert.ok(retryAction);
    assert.deepEqual(
      stackState.routes.map((route) => route.key),
      initialKeys,
    );
    protectedKey = undefined;
    dispatch(retryAction);
    assert.deepEqual(
      stackState.routes.map((route) => route.name),
      ['index'],
    );
    if (names[0] === 'index') {
      assert.equal(stackState.routes[0].key, initialKeys[0]);
    }
  }
});
