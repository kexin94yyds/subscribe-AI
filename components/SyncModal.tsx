import React from 'react';
import { Download, Laptop, RefreshCw, Smartphone, Upload, X } from 'lucide-react';
import { Button } from './Button';
import { SyncCounts } from '../services/syncService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  counts: SyncCounts;
  isNativePlatform: boolean;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
  counts,
  isNativePlatform,
}) => {
  if (!isOpen) return null;

  const deviceLabel = isNativePlatform ? '手机端' : '电脑端';
  const DeviceIcon = isNativePlatform ? Smartphone : Laptop;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl border-2 border-black bg-white p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-black text-white">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">电脑同步</h2>
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
            aria-label="关闭电脑同步"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2">
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={onExport} className="h-11">
            <Upload className="mr-2 h-4 w-4" />
            导出同步包
          </Button>
          <Button variant="outline" onClick={onImport} className="h-11">
            <Download className="mr-2 h-4 w-4" />
            导入同步包
          </Button>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          同步包包含订阅、提醒和目标。导入时会以文件内容覆盖本机数据，适合在手机和电脑之间保持一致。
        </p>
      </div>
    </div>
  );
};
