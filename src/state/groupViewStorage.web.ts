import { createGroupViewRepository } from './groupView';

export const groupViewRepository = createGroupViewRepository({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
