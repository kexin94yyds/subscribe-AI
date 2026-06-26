import { Account as AppwriteAccount, AppwriteException, Client, Storage, TablesDB } from 'appwrite';

const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const appwriteProjectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const appwriteDatabaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const appwriteTableId = import.meta.env.VITE_APPWRITE_TABLE_ID;
const appwriteCalendarFeedBucketId = import.meta.env.VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID;

export const appwriteConfig = {
  endpoint: appwriteEndpoint,
  projectId: appwriteProjectId,
  databaseId: appwriteDatabaseId,
  tableId: appwriteTableId,
  calendarFeedBucketId: appwriteCalendarFeedBucketId,
};

export const isAppwriteConfigured = (): boolean => Boolean(
  appwriteEndpoint &&
  appwriteProjectId &&
  appwriteDatabaseId &&
  appwriteTableId
);

const appwriteClient = isAppwriteConfigured()
  ? new Client()
      .setEndpoint(appwriteEndpoint)
      .setProject(appwriteProjectId)
  : null;

export const appwriteAccount = appwriteClient ? new AppwriteAccount(appwriteClient) : null;
export const appwriteTables = appwriteClient ? new TablesDB(appwriteClient) : null;
export const appwriteStorage = appwriteClient ? new Storage(appwriteClient) : null;

export const isAppwriteAuthError = (error: unknown): boolean => {
  if (error instanceof AppwriteException) {
    return error.code === 401;
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 401
  );
};
