import React, { useState } from 'react';
import { Download, Laptop, LogOut, RefreshCw, Smartphone, Upload, User, X } from 'lucide-react';
import { Button } from './Button';
import { CloudSyncStatus } from '../services/cloudSyncService';
import { SyncCounts } from '../services/syncService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (otp: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  counts: SyncCounts;
  isNativePlatform: boolean;
  status: CloudSyncStatus;
  statusMessage: string;
  pendingOtpEmail?: string;
  userEmail?: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
  onSendOtp,
  onVerifyOtp,
  onSignOut,
  onSyncNow,
  counts,
  isNativePlatform,
  status,
  statusMessage,
  pendingOtpEmail,
  userEmail,
}) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitAction, setSubmitAction] = useState<'send' | 'verify' | null>(null);

  if (!isOpen) return null;

  const deviceLabel = isNativePlatform ? '手机端' : '电脑端';
  const DeviceIcon = isNativePlatform ? Smartphone : Laptop;
  const isBusy = status === 'syncing' || submitAction !== null;
  const canSync = Boolean(userEmail) && (status === 'synced' || status === 'error');
  const showLoginControls = !userEmail && (status === 'signed_out' || status === 'syncing' || status === 'error');

  const handleSendOtp = async () => {
    if (!email.trim()) return;

    setSubmitAction('send');
    try {
      await onSendOtp(email.trim());
    } finally {
      setSubmitAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;

    setSubmitAction('verify');
    try {
      await onVerifyOtp(otp.trim());
      setOtp('');
    } finally {
      setSubmitAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl border-2 border-black bg-white p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-black text-white">
              <RefreshCw className={`h-5 w-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">云同步</h2>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <DeviceIcon className="h-3.5 w-3.5" />
                <span>{deviceLabel}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:border-black hover:bg-black hover:text-white"
            title="关闭"
            aria-label="关闭云同步"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            ['订阅', counts.accounts],
            ['提醒', counts.reminders],
            ['目标', counts.goals],
            ['合计', counts.total],
          ].map(([label, value]) => (
            <div key={label} className="border border-gray-200 p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4" />
            <span>{userEmail || '未登录'}</span>
          </div>
          <p className={`mt-1 text-xs ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {statusMessage}
          </p>
        </div>

        {showLoginControls && (
          <div className="mb-4 flex flex-col gap-3">
            {pendingOtpEmail && (
              <p className="text-xs text-gray-500">
                验证码已发送至 <span className="font-semibold text-gray-700">{pendingOtpEmail}</span>
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="email@example.com"
                disabled={isBusy}
                className="h-11 flex-1 border border-gray-300 px-3 text-sm outline-none transition-colors focus:border-black"
              />
              <Button
                onClick={handleSendOtp}
                isLoading={submitAction === 'send'}
                disabled={!email.trim() || isBusy}
                className="h-11"
              >
                {pendingOtpEmail ? '重新发送验证码' : '发送验证码'}
              </Button>
            </div>
            {pendingOtpEmail && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={event => setOtp(event.target.value)}
                  placeholder="验证码"
                  disabled={isBusy}
                  className="h-11 flex-1 border border-gray-300 px-3 text-sm outline-none transition-colors focus:border-black"
                />
                <Button
                  onClick={handleVerifyOtp}
                  isLoading={submitAction === 'verify'}
                  disabled={!otp.trim() || isBusy}
                  className="h-11"
                >
                  登录并同步
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={onSyncNow} disabled={!canSync || isBusy} isLoading={status === 'syncing'} className="h-11">
            <RefreshCw className="mr-2 h-4 w-4" />
            立即同步
          </Button>
          <Button variant="outline" onClick={onSignOut} disabled={!userEmail || isBusy} className="h-11">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <Button variant="outline" onClick={onExport} className="h-10">
            <Upload className="mr-2 h-4 w-4" />
            导出备份
          </Button>
          <Button variant="outline" onClick={onImport} className="h-10">
            <Download className="mr-2 h-4 w-4" />
            导入备份
          </Button>
        </div>
      </div>
    </div>
  );
};
