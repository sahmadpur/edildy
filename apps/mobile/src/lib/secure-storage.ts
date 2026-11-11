import * as SecureStore from 'expo-secure-store';
import { readMigrating } from './legacy-storage';

export const STORAGE_KEYS = {
  refreshToken: 'edildy.refreshToken',
  me: 'edildy.me',
  orgCode: 'edildy.orgCode',
  /** The Expo push token this phone registered last (decision 7). */
  pushToken: 'edildy.pushToken',
} as const;

const store = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

/** Reads also pick up a value a Taskop build stored under the old key name (legacy-storage.ts). */
export const secureStorage = { ...store, get: (key: string) => readMigrating(store, key) };
