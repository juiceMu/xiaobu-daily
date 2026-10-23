import Storage from 'expo-sqlite/kv-store';
import { createGroupViewRepository } from './groupView';

export const groupViewRepository = createGroupViewRepository({
  getItem: (key) => Storage.getItemAsync(key),
  setItem: (key, value) => Storage.setItemAsync(key, value),
});
