import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: {
    createEmailToken: vi.fn(),
    createSession: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('./appwriteClient', () => ({
  appwriteAccount: mocks.account,
  appwriteConfig: {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    projectId: 'project-id',
    databaseId: 'monoexpire',
    tableId: 'monoexpire_items',
  },
  appwriteTables: null,
  isAppwriteAuthError: (error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 401
  ),
}));

describe('cloud sync Email OTP auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Appwrite token user ID when sending an Email OTP', async () => {
    const { sendCloudEmailOtp } = await import('./cloudSyncService');
    mocks.account.createEmailToken.mockResolvedValue({
      userId: 'existing-appwrite-user',
    });

    const result = await sendCloudEmailOtp('person@example.com');

    expect(mocks.account.createEmailToken).toHaveBeenCalledWith({
      userId: expect.any(String),
      email: 'person@example.com',
    });
    expect(result).toEqual({ userId: 'existing-appwrite-user' });
  });

  it('creates a session from the Email OTP and returns the authenticated user', async () => {
    const { verifyCloudEmailOtp } = await import('./cloudSyncService');
    mocks.account.createSession.mockResolvedValue({});
    mocks.account.get.mockResolvedValue({
      $id: 'existing-appwrite-user',
      email: 'person@example.com',
    });

    const session = await verifyCloudEmailOtp('existing-appwrite-user', '123456');

    expect(mocks.account.createSession).toHaveBeenCalledWith({
      userId: 'existing-appwrite-user',
      secret: '123456',
    });
    expect(session).toEqual({
      user: {
        id: 'existing-appwrite-user',
        email: 'person@example.com',
      },
    });
  });
});
