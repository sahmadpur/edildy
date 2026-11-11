import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_STORAGE_KEY } from '@edildy/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/lib/i18n';
import { LanguagePicker } from './language-picker';

const mockUpdate = jest.fn();
const mockPatchUser = jest.fn();
const mockState = { current: { status: 'anonymous' } as { status: string; me?: unknown } };
jest.mock('@/lib/session', () => ({
  api: { preferences: { update: (...a: unknown[]) => mockUpdate(...a) } },
  session: { get: () => mockState.current, patchUser: (...a: unknown[]) => mockPatchUser(...a) },
}));

beforeEach(() => {
  mockUpdate.mockReset();
  mockPatchUser.mockReset();
  mockState.current = { status: 'anonymous' };
});
afterEach(async () => {
  await i18n.changeLanguage('az');
  await AsyncStorage.clear();
});

describe('LanguagePicker', () => {
  it('lists the three languages in their own names with Azerbaijani selected', async () => {
    await render(<LanguagePicker />);
    expect(screen.getByRole('radio', { name: 'Azərbaycan dili' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: 'English' }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole('radio', { name: 'Русский' })).toBeTruthy();
  });

  it('flags variant shows only the flag but still names the language for assistive tech', async () => {
    await render(<LanguagePicker variant="flags" />);
    const az = screen.getByRole('radio', { name: 'Azərbaycan dili' });
    expect(az.props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('🇦🇿')).toBeTruthy();
    expect(screen.queryByText('English')).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    await waitFor(() => expect(i18n.language).toBe('en'));
  });

  it('dropdown variant shows the current flag and opens a menu of flags with names', async () => {
    await render(<LanguagePicker variant="dropdown" />);
    const trigger = screen.getByRole('button', { name: 'Dil: Azərbaycan dili' });
    expect(screen.getByText('🇦🇿')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'English' })).toBeNull();
    await fireEvent.press(trigger);
    expect(screen.getByRole('radio', { name: 'Azərbaycan dili' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Русский')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    await waitFor(() => expect(i18n.language).toBe('en'));
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'English' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Language: English' })).toBeTruthy();
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('switches the UI language and stores the choice on the phone', async () => {
    await render(<LanguagePicker />);
    fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(screen.getByRole('radio', { name: 'English' }).props.accessibilityState.selected).toBe(true);
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('LanguagePicker while signed in', () => {
  it('saves the choice to the profile and applies the saved value to the session', async () => {
    mockState.current = { status: 'authenticated', me: { user: { id: 'u1', locale: null } } };
    mockUpdate.mockResolvedValue({ emailNotifications: true, locale: 'ru' });
    await render(<LanguagePicker />);
    fireEvent.press(screen.getByRole('radio', { name: 'Русский' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ locale: 'ru' }));
    await waitFor(() => expect(mockPatchUser).toHaveBeenCalledWith({ locale: 'ru' }, 'u1'));
    expect(i18n.language).toBe('ru');
  });

  it('keeps the local choice when the profile cannot be saved', async () => {
    mockState.current = { status: 'authenticated', me: { user: { id: 'u1', locale: null } } };
    mockUpdate.mockRejectedValue(new Error('offline'));
    await render(<LanguagePicker />);
    fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(i18n.language).toBe('en');
    expect(mockPatchUser).not.toHaveBeenCalled();
  });
});
