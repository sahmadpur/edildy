// Jest setup: native modules that jest-expo does not mock on its own.
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(async () => null),
  getLastKnownPositionAsync: jest.fn(async () => null),
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'az-AZ', languageCode: 'az' }] }));
