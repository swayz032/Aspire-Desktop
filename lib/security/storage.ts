let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

export async function getItem(key: string): Promise<string | null> {
  if (SecureStore?.getItemAsync) {
    return SecureStore.getItemAsync(key);
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (SecureStore?.setItemAsync) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

export async function removeItem(key: string): Promise<void> {
  if (SecureStore?.deleteItemAsync) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}
