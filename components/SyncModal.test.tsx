import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SyncModal } from './SyncModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onSignOut: vi.fn(),
  onSyncNow: vi.fn(),
  counts: {
    accounts: 0,
    reminders: 0,
    goals: 0,
    total: 0,
  },
  isNativePlatform: false,
  status: 'signed_out' as const,
  statusMessage: '登录后自动同步手机和电脑数据',
};

describe('SyncModal Email OTP login', () => {
  it('asks signed-out users to send an email verification code', () => {
    const html = renderToStaticMarkup(
      <SyncModal
        {...baseProps}
        onSendOtp={vi.fn()}
        onVerifyOtp={vi.fn()}
      />
    );

    expect(html).toContain('发送验证码');
    expect(html).not.toContain('发送登录邮件');
  });

  it('shows the OTP input after a code has been sent', () => {
    const html = renderToStaticMarkup(
      <SyncModal
        {...baseProps}
        pendingOtpEmail="person@example.com"
        onSendOtp={vi.fn()}
        onVerifyOtp={vi.fn()}
      />
    );

    expect(html).toContain('person@example.com');
    expect(html).toContain('验证码');
    expect(html).toContain('登录并同步');
  });

  it('keeps the OTP controls visible after a verification error', () => {
    const html = renderToStaticMarkup(
      <SyncModal
        {...baseProps}
        status="error"
        statusMessage="验证码无效，请重试"
        pendingOtpEmail="person@example.com"
        onSendOtp={vi.fn()}
        onVerifyOtp={vi.fn()}
      />
    );

    expect(html).toContain('验证码无效，请重试');
    expect(html).toContain('person@example.com');
    expect(html).toContain('登录并同步');
  });
});
