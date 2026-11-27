import type { BottomTabBarProps } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font, spacing } from '@/lib/theme';

/** The route that sits raised in the middle of the bar. */
export const CENTRE_ROUTE = 'index';

type Route = BottomTabBarProps['state']['routes'][number];

/** expo-router turns `href: null` into a hidden item style; those routes are reached from inside the app. */
function isHidden(style: unknown): boolean {
  return (StyleSheet.flatten(style as StyleProp<ViewStyle>) as ViewStyle | undefined)?.display === 'none';
}

/**
 * The bottom bar: Home is a raised round button fixed in the centre and the other tabs, in route order, are split
 * evenly around it, the extra one on the left when the count is odd. The plan hides tabs (Basic and Pro have no
 * Tapşırıqlar or Problemlər), so the split is by count, not by where Home sits in the routes (feedback 2026-11-27).
 * Every tab has the same width and the shorter side is centred in its half, so the bar stays balanced on any plan.
 * Screens that hide the bar (`tabBarStyle: { display: 'none' }`) hide it here too.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const focused = state.routes[state.index];
  if (focused && isHidden(descriptors[focused.key]?.options.tabBarStyle)) return null;
  const visible = state.routes.filter((r) => !isHidden(descriptors[r.key]?.options.tabBarItemStyle));
  const centre = visible.find((r) => r.name === CENTRE_ROUTE) ?? null;
  const others = visible.filter((r) => r !== centre);
  const leftCount = centre ? Math.ceil(others.length / 2) : others.length;
  const left = others.slice(0, leftCount);
  const right = others.slice(leftCount);
  const width = `${100 / Math.max(left.length, right.length, 1)}%` as const;

  const press = (route: Route) => {
    const isFocused = focused?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const item = (route: Route) => {
    const { options } = descriptors[route.key]!;
    const on = focused?.key === route.key;
    const color = on ? colors.primary : colors.muted;
    const label = typeof options.title === 'string' ? options.title : route.name;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        testID={`tab-${route.name}`}
        onPress={() => press(route)}
        style={[styles.item, { width }]}
      >
        {options.tabBarIcon?.({ focused: on, color, size: 24 })}
        <Text numberOfLines={1} style={[styles.label, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.half}>{left.map(item)}</View>
      {centre ? <View style={styles.gap} /> : null}
      <View style={styles.half}>{right.map(item)}</View>
      {centre ? <CentreButton route={centre} on={focused?.key === centre.key} label={descriptors[centre.key]?.options.title ?? centre.name} onPress={() => press(centre)} /> : null}
    </View>
  );
}

function CentreButton({ route, on, label, onPress }: { route: Route; on: boolean; label: string; onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.centreWrap}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        testID={`tab-${route.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.centre, pressed && styles.centrePressed]}
      >
        <Ionicons name={on ? 'home' : 'home-outline'} size={26} color={colors.primaryText} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.label, { color: on ? colors.primary : colors.muted }]}>
        {label}
      </Text>
    </View>
  );
}

const CENTRE = 58;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  half: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  gap: { width: CENTRE + spacing.md },
  item: { minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontFamily: font, fontSize: 11, fontWeight: '500' },
  centreWrap: { position: 'absolute', left: 0, right: 0, top: -CENTRE / 2 + 4, alignItems: 'center', gap: 2 },
  centre: {
    width: CENTRE,
    height: CENTRE,
    borderRadius: CENTRE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  centrePressed: { opacity: 0.85 },
});
