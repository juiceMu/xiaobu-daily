import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
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
    assert.equal(
      prop(button, 'rippleColor'),
      "'transparent'",
    );
    assert.ok(prop(button, 'onFocus')?.includes('setFocusedAction'));
    assert.ok(prop(button, 'onBlur')?.includes('setFocusedAction(null)'));
    assert.ok(style?.includes('focusedAction'));
    assert.ok(style?.includes('keyboardFocus.focusVisible'));
    assert.ok(prop(button, 'onFocus')?.includes('keyboardFocus.onFocus()'));
    assert.ok(prop(button, 'onBlur')?.includes('keyboardFocus.onBlur()'));
    assert.ok(style?.includes('borderColor: colors.primary'));
    assert.ok(prop(button, 'accessibilityLabel')?.includes('item.name'));
  }
  assert.ok(
    today.text.includes(
      "const taskActionSize = Platform.OS === 'web' ? 36 : 44",
    ),
  );
  const icon = prop(checkin, 'icon');
  assert.ok(icon?.includes("'check-circle'"));
  assert.ok(icon?.includes("'checkbox-marked-circle-outline'"));
  assert.equal(icon?.includes("'plus'"), false);
  assert.ok(icon?.includes('width: 28'));
  assert.ok(icon?.includes('height: 28'));
  assert.ok(icon?.includes('size={18}'));
  assert.ok(icon?.includes('color={color}'));
  assert.ok(icon?.includes('busy || complete'));
  assert.equal(prop(checkin, 'disabled'), 'busy || complete');
  assert.ok(prop(checkin, 'accessibilityLabel')?.includes('当天已完成'));
  assert.ok(prop(checkin, 'accessibilityLabel')?.includes('，打卡'));
  assert.ok(
    prop(checkin, 'onPress')?.includes(
      'checkIn(draft, item.id, new Date(), selectedDate)',
    ),
  );
  assert.equal(prop(undo, 'icon'), '"undo-variant"');
  assert.equal(prop(undo, 'disabled'), 'busy || !count');
  assert.equal(prop(undo, 'onPress'), "() => ask('undo', item)");
  assert.ok(prop(undo, 'accessibilityLabel')?.includes('最近一次打卡'));
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
  assert.equal(
    more.elseStatement?.getText(app),
    'navigation.navigate(route.name);',
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
    'return (' + handler.expression.getText(app) + ')',
  )(navigation, state, StackActions) as (event: {
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
