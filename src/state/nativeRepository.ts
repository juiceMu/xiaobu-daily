import * as SQLite from 'expo-sqlite';
import { createSQLiteRepository } from './sqliteRepository';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
export const DATABASE_NAME = 'sprout-native-sync-v1.db';

async function connect(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).catch(
      (error: unknown) => {
        databasePromise = null;
        throw error;
      },
    );
  }
  return databasePromise;
}

export const nativeRepository = createSQLiteRepository(connect);
