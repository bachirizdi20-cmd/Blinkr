import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@blinkr/cache/';

export async function readPersistentCache<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!parsed || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > maxAgeMs) {
      void AsyncStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export async function writePersistentCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Cache failure must never prevent the live request or screen from rendering.
  }
}
