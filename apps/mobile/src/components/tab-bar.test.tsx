import { fireEvent, render, screen } from '@testing-library/react-native';
import { TabBar } from './tab-bar';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

type Props = Parameters<typeof TabBar>[0];

function props(names: string[], opts: { hidden?: string[]; focused?: string } = {}) {
  const routes = names.map((name) => ({ key: `${name}-k`, name, params: undefined }));
  const descriptors = Object.fromEntries(
    routes.map((r) => [r.key, { options: { title: r.name.toUpperCase(), ...(opts.hidden?.includes(r.name) ? { tabBarItemStyle: { display: 'none' } } : {}) } }]),
  );
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  const index = Math.max(0, names.indexOf(opts.focused ?? 'index'));
  return { state: { index, routes }, descriptors, navigation, insets: { top: 0, bottom: 0, left: 0, right: 0 } } as unknown as Props & { navigation: typeof navigation };
}

describe('TabBar (Nov 2026 feedback points 1–2)', () => {
  it('puts Home in the centre with the other tabs split around it, and skips hidden routes', async () => {
    const p = props(['tasks', 'problems/index', 'index', 'team/index', 'profile', 'sync'], { hidden: ['team/index', 'sync'] });
    await render(<TabBar {...p} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual(['tab-tasks', 'tab-problems/index', 'tab-profile', 'tab-index']);
    expect(screen.getByTestId('tab-index').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByTestId('tab-sync')).toBeNull();
  });

  it('navigates to a tab that is not focused', async () => {
    const p = props(['tasks', 'problems/index', 'index', 'profile']);
    await render(<TabBar {...p} />);
    await fireEvent.press(screen.getByTestId('tab-tasks'));
    expect(p.navigation.navigate).toHaveBeenCalledWith('tasks', undefined);
    await fireEvent.press(screen.getByTestId('tab-index'));
    expect(p.navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('hides itself on screens that hide the bar', async () => {
    const p = props(['index', 'execution/[id]/index'], { focused: 'execution/[id]/index' });
    (p.descriptors['execution/[id]/index-k']!.options as { tabBarStyle?: object }).tabBarStyle = { display: 'none' };
    await render(<TabBar {...p} />);
    expect(screen.queryByRole('tab')).toBeNull();
  });
});
