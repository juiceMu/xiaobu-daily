import type { AccountJournal } from '../domain/syncModel';

export interface LanExchange {
  groupId: string;
  secret: string;
  accountId: string;
  journals: AccountJournal[];
}
