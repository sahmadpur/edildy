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

  it('splits by count when the plan hides the tabs before Home (feedback 2026-11-27)', async () => {
    // Pro: no Tapşırıqlar or Problemlər, so every visible tab comes after Home in the routes.
    const manager = props(['tasks', 'problems/index', 'index', 'calendar', 'team/index', 'profile'], { hidden: ['tasks', 'problems/index'] });
    await render(<TabBar {...manager} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual(['tab-calendar', 'tab-team/index', 'tab-profile', 'tab-index']);
    // Two slots a side: the lone right tab is as wide as the left ones.
    expect(screen.getByTestId('tab-profile').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '50%' })]));
  });

  it('gives a Pro worker one tab a side', async () => {
    const worker = props(['tasks', 'problems/index', 'index', 'calendar', 'team/index', 'profile'], { hidden: ['tasks', 'problems/index', 'team/index'] });
    await render(<TabBar {...worker} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual(['tab-calendar', 'tab-profile', 'tab-index']);
  });

  it('puts the odd tab on the left with every tab on (XL)', async () => {
    const p = props(['tasks', 'problems/index', 'index', 'calendar', 'team/index', 'profile']);
    await render(<TabBar {...p} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual(['tab-tasks', 'tab-problems/index', 'tab-calendar', 'tab-team/index', 'tab-profile', 'tab-index']);
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
