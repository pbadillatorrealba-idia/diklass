import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { type AuthStorage, createWebStorage } from "@/lib/storage/auth-storage";

function createNativeStorage(): AuthStorage {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: async (key, value) => {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

export function createPlatformAuthStorage(): AuthStorage {
  return Platform.OS === "web" ? createWebStorage() : createNativeStorage();
}
