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
  onSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  counts: SyncCounts;
  isNativePlatform: boolean;
  status: CloudSyncStatus;
  statusMessage: string;
  userEmail?: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
  onSignIn,
  onSignOut,
  onSyncNow,
  counts,
  isNativePlatform,
  status,
  statusMessage,
  userEmail,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const deviceLabel = isNativePlatform ? '手机端' : '电脑端';
  const DeviceIcon = isNativePlatform ? Smartphone : Laptop;
  const isBusy = status === 'syncing' || isSubmitting;
  const canSync = status === 'synced' || status === 'error';

  const handleSignIn = async () => {
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      await onSignIn(email.trim());
    } finally {
      setIsSubmitting(false);
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

        {status === 'signed_out' && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="email@example.com"
              className="h-11 flex-1 border border-gray-300 px-3 text-sm outline-none transition-colors focus:border-black"
            />
            <Button onClick={handleSignIn} isLoading={isSubmitting} disabled={!email.trim()} className="h-11">
              发送登录邮件
            </Button>
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
