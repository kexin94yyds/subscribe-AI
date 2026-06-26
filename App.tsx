import React, { useState, useEffect } from 'react';
import { Plus, Command, LayoutGrid, List as ListIcon, Search, Download, Upload, Calendar, Bell, BellRing, RefreshCw } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { v4 as uuidv4 } from 'uuid';
import { AccountCard } from './components/AccountCard';
import { ReminderCard } from './components/ReminderCard';
import { GoalCard } from './components/GoalCard';
import { Button } from './components/Button';
import { SmartAddModal } from './components/SmartAddModal';
import { ReminderModal } from './components/ReminderModal';
import { GoalModal } from './components/GoalModal';
import { PageTypeSelector } from './components/PageTypeSelector';
import { SyncModal } from './components/SyncModal';
import { 
  getStoredAccounts, 
  saveAccountsToStorage, 
  migrateFromLocalStorage,
  getStoredReminders,
  saveRemindersToStorage,
  getStoredGoals,
  saveGoalsToStorage,
  getOrCreateDeviceId
} from './services/storageService';
import {
  NotificationPermissionState,
  checkSubscriptionNotificationPermission,
  enableSubscriptionExpiryNotifications,
  syncSubscriptionExpiryNotifications
} from './services/notificationService';
import {
  countSyncData,
  createMonoExpireBackup,
  normalizeSyncData,
  parseMonoExpireBackup,
  sortAccounts,
  sortGoals,
  touchAccount,
  touchGoal,
  touchReminder,
  MonoExpireData
} from './services/syncService';
import {
  CloudItemType,
  CloudSyncStatus,
  getCloudSession,
  markCloudItemDeleted,
  sendCloudEmailOtp,
  signOutFromCloud,
  syncMonoExpireData,
  verifyCloudEmailOtp
} from './services/cloudSyncService';
import { isAppwriteConfigured } from './services/appwriteClient';
import { Account, Reminder, Goal, PageType, ParsedAccountData } from './types';

// Simple modal for manual add/edit to keep App.tsx cleaner
const ManualModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (data: Omit<Account, 'id'>) => void;
    initialData?: Account;
}) => {
    const [formData, setFormData] = useState({ name: '', provider: '', expirationDate: '', notes: '', refreshCycleDays: '', nextRefreshDate: '' });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    provider: initialData.provider || '',
                    expirationDate: initialData.expirationDate,
                    notes: initialData.notes || '',
                    refreshCycleDays: initialData.refreshCycleDays?.toString() || '',
                    nextRefreshDate: initialData.nextRefreshDate || ''
                });
            } else {
                setFormData({ name: '', provider: '', expirationDate: '', notes: '', refreshCycleDays: '', nextRefreshDate: '' });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-2 border-black w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
                <h2 className="text-xl font-bold mb-4">{initialData ? '编辑账号' : '添加新账号'}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">账号名称</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                            placeholder="例如：ChatGPT Plus"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">服务商 (可选)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                            placeholder="例如：OpenAI"
                            value={formData.provider}
                            onChange={e => setFormData({...formData, provider: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">到期日期</label>
                        <input 
                            type="date" 
                            className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                            value={formData.expirationDate}
                            onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">备注 (可选)</label>
                        <textarea 
                            className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors resize-none h-20"
                            placeholder="例如：每月20刀自动扣费"
                            value={formData.notes}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">刷新周期 (天)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                                placeholder="如30"
                                value={formData.refreshCycleDays}
                                onChange={e => setFormData({...formData, refreshCycleDays: e.target.value})}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">下次刷新日期</label>
                            <input 
                                type="date" 
                                className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                                value={formData.nextRefreshDate}
                                onChange={e => setFormData({...formData, nextRefreshDate: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button 
                        disabled={!formData.name || !formData.expirationDate}
                        onClick={() => onSave({
                            type: 'subscription',
                            ...formData,
                            refreshCycleDays: formData.refreshCycleDays ? parseInt(formData.refreshCycleDays) : undefined,
                            nextRefreshDate: formData.nextRefreshDate || undefined
                        })}
                    >
                        保存
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false); // 防止初始化时覆盖存储
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('monoexpire_view_mode');
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });
  const [pageType, setPageType] = useState<PageType>(() => {
    // 从 localStorage 读取上次选择的页面类型
    const saved = localStorage.getItem('monoexpire_page_type');
    return (saved as PageType) || 'subscription';
  });
  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>('unsupported');
  const [notificationScheduledCount, setNotificationScheduledCount] = useState(0);
  const [deviceId, setDeviceId] = useState('');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('disabled');
  const [cloudSyncMessage, setCloudSyncMessage] = useState('未配置 Appwrite');
  const [cloudUserEmail, setCloudUserEmail] = useState('');
  const [pendingOtpUserId, setPendingOtpUserId] = useState('');
  const [pendingOtpEmail, setPendingOtpEmail] = useState('');
  const [pendingCloudSync, setPendingCloudSync] = useState(false);

  // 导出到日历 (ICS格式) - 根据当前页面类型导出
  const handleExportToCalendar = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorCalendar.requestFullCalendarAccess();
        
        const selectedCalendars = await CapacitorCalendar.selectCalendarsWithPrompt({
          displayStyle: 0
        });
        
        if (!selectedCalendars.result?.length) {
          return;
        }
        
        const calendarId = selectedCalendars.result[0].id;
        let addedCount = 0;
        let skippedCount = 0;

        if (pageType === 'subscription') {
          // 导出订阅
          for (const account of accounts) {
            const startDate = new Date(account.expirationDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            const title = `${account.name} 订阅到期`;
            
            try {
              const existingEvents = await CapacitorCalendar.listEventsInRange({
                from: startDate.getTime(),
                to: endDate.getTime()
              });
              
              const isDuplicate = existingEvents.result?.some(
                (event: any) => event.title === title
              );
              
              if (!isDuplicate) {
                await CapacitorCalendar.createEvent({
                  title: title,
                  calendarId: calendarId,
                  startDate: startDate.getTime(),
                  endDate: endDate.getTime(),
                  isAllDay: true,
                  description: account.notes || (account.provider ? `服务商: ${account.provider}` : ''),
                  alerts: [-(3 * 24 * 60), -(2 * 24 * 60), -(24 * 60), -60]
                });
                addedCount++;
              } else {
                skippedCount++;
              }
            } catch (e) {}
          }
        } else if (pageType === 'reminder') {
          // 导出提醒 - 使用每个提醒设置的日历导出天数
          for (const reminder of reminders) {
            const times = reminder.times || ['08:00'];
            const DAYS_TO_CREATE = reminder.calendarDays || 30;
            
            for (let dayOffset = 0; dayOffset < DAYS_TO_CREATE; dayOffset++) {
              const eventDate = new Date();
              eventDate.setDate(eventDate.getDate() + dayOffset);
              const dayOfWeek = eventDate.getDay(); // 0=周日, 1=周一, ...
              
              // 根据重复规则判断是否需要创建事件
              let shouldCreate = false;
              if (reminder.repeatRule === 'none' && dayOffset === 0) {
                shouldCreate = true;
              } else if (reminder.repeatRule === 'daily') {
                shouldCreate = true;
              } else if (reminder.repeatRule === 'weekdays') {
                shouldCreate = dayOfWeek >= 1 && dayOfWeek <= 5;
              } else if (reminder.repeatRule === 'weekly' && reminder.customDays?.length) {
                shouldCreate = reminder.customDays.includes(dayOfWeek);
              } else if (reminder.repeatRule === 'custom' && reminder.customDays?.length) {
                shouldCreate = reminder.customDays.includes(dayOfWeek);
              }
              
              if (!shouldCreate) continue;
              
              for (const time of times) {
                const [hours, minutes] = time.split(':').map(Number);
                const startTime = new Date(eventDate);
                startTime.setHours(hours, minutes, 0, 0);
                const endTime = new Date(startTime);
                endTime.setMinutes(endTime.getMinutes() + 30);
                
                const title = `${reminder.name}`;
                
                try {
                  await CapacitorCalendar.createEvent({
                    title: title,
                    calendarId: calendarId,
                    startDate: startTime.getTime(),
                    endDate: endTime.getTime(),
                    isAllDay: false,
                    description: reminder.notes || '',
                    alerts: [-5]
                  });
                  addedCount++;
                } catch (e) {}
              }
            }
          }
        } else if (pageType === 'goal') {
          // 导出目标 - 截止日期事件
          for (const goal of goals) {
            if (goal.isCompleted) continue; // 跳过已完成的目标
            
            const startDate = new Date(goal.deadline);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            const title = `🎯 ${goal.name} 截止`;
            
            try {
              const existingEvents = await CapacitorCalendar.listEventsInRange({
                from: startDate.getTime(),
                to: endDate.getTime()
              });
              
              const isDuplicate = existingEvents.result?.some(
                (event: any) => event.title === title
              );
              
              if (!isDuplicate) {
                await CapacitorCalendar.createEvent({
                  title: title,
                  calendarId: calendarId,
                  startDate: startDate.getTime(),
                  endDate: endDate.getTime(),
                  isAllDay: true,
                  description: goal.notes || '',
                  alerts: [-(7 * 24 * 60), -(3 * 24 * 60), -(24 * 60)]
                });
                addedCount++;
              } else {
                skippedCount++;
              }
            } catch (e) {}
          }
        }
        
        await CapacitorCalendar.openCalendar({ date: Date.now() });
        
        const typeLabel = pageType === 'subscription' ? '订阅' : pageType === 'reminder' ? '提醒' : '目标';
        if (skippedCount > 0) {
          alert(`已添加 ${addedCount} 个${typeLabel}事件，跳过 ${skippedCount} 个已存在的事件`);
        } else if (addedCount > 0) {
          alert(`已添加 ${addedCount} 个${typeLabel}事件`);
        } else {
          alert(`没有${typeLabel}需要导出`);
        }
      } catch (e: any) {
        if (!e.message?.includes('denied') && !e.message?.includes('cancel')) {
          alert('添加失败: ' + (e.message || e));
        }
      }
    } else {
      alert('日历导出仅支持 iOS/Android 设备');
    }
  };

  const handleEnableSubscriptionNotifications = async () => {
    try {
      const result = await enableSubscriptionExpiryNotifications(accounts);
      setNotificationPermission(result.permission);
      setNotificationScheduledCount(result.scheduledCount);

      if (result.permission === 'unsupported') {
        alert('系统通知仅支持 iOS/Android App');
      } else if (result.permission !== 'granted') {
        alert('未获得通知权限，请在系统设置中允许 MonoExpire 发送通知');
      } else if (result.scheduledCount > 0) {
        alert(`已安排 ${result.scheduledCount} 条订阅到期系统通知`);
      } else {
        alert('当前没有未来到期的订阅可安排通知');
      }
    } catch (e: any) {
      alert('设置系统通知失败: ' + (e.message || e));
    }
  };

  const applySyncedData = (data: MonoExpireData) => {
    setAccounts(sortAccounts(data.accounts));
    setReminders(data.reminders);
    setGoals(sortGoals(data.goals));
  };

  const getLocalSyncData = (): MonoExpireData => ({
    accounts,
    reminders,
    goals,
  });

  const getSyncErrorMessage = (error: unknown) => {
    return error instanceof Error ? error.message : '同步失败';
  };

  const runCloudSync = async (dataOverride?: MonoExpireData, options: { silent?: boolean } = {}) => {
    if (!isAppwriteConfigured()) {
      setCloudSyncStatus('disabled');
      setCloudSyncMessage('缺少 Appwrite 环境变量');
      return;
    }

    const activeDeviceId = deviceId || await getOrCreateDeviceId();
    if (!deviceId) {
      setDeviceId(activeDeviceId);
    }

    try {
      if (!options.silent) {
        setCloudSyncStatus('syncing');
        setCloudSyncMessage('正在同步...');
      }

      const result = await syncMonoExpireData(dataOverride || getLocalSyncData(), activeDeviceId);
      applySyncedData(result.data);
      setCloudSyncStatus('synced');
      setCloudSyncMessage(`已同步：上传 ${result.uploadedCount}，拉取 ${result.downloadedCount}`);
    } catch (error) {
      const message = getSyncErrorMessage(error);
      if (message.includes('Not signed in')) {
        setCloudSyncStatus('signed_out');
        setCloudSyncMessage('登录后自动同步手机和电脑数据');
        setCloudUserEmail('');
      } else {
        setCloudSyncStatus('error');
        setCloudSyncMessage(message);
      }
    }
  };

  const queueCloudSync = () => {
    if (cloudSyncStatus === 'disabled' || cloudSyncStatus === 'signed_out') return;
    setPendingCloudSync(true);
  };

  const handleCloudSendOtp = async (email: string) => {
    try {
      setCloudSyncStatus('syncing');
      setCloudSyncMessage('正在发送验证码...');
      const challenge = await sendCloudEmailOtp(email);
      setPendingOtpUserId(challenge.userId);
      setPendingOtpEmail(email);
      setCloudSyncStatus('signed_out');
      setCloudSyncMessage('验证码已发送，请输入邮件中的验证码');
    } catch (error) {
      setCloudSyncStatus('error');
      setCloudSyncMessage(getSyncErrorMessage(error));
    }
  };

  const handleCloudVerifyOtp = async (otp: string) => {
    if (!pendingOtpUserId) {
      setCloudSyncStatus('error');
      setCloudSyncMessage('请先发送验证码');
      return;
    }

    try {
      setCloudSyncStatus('syncing');
      setCloudSyncMessage('正在验证验证码...');
      const session = await verifyCloudEmailOtp(pendingOtpUserId, otp);
      setCloudUserEmail(session.user.email || pendingOtpEmail || '已登录');
      setPendingOtpUserId('');
      setPendingOtpEmail('');
      await runCloudSync();
    } catch (error) {
      setCloudSyncStatus('error');
      setCloudSyncMessage(getSyncErrorMessage(error));
    }
  };

  const handleCloudSignOut = async () => {
    try {
      await signOutFromCloud();
      setCloudUserEmail('');
      setPendingOtpUserId('');
      setPendingOtpEmail('');
      setCloudSyncStatus('signed_out');
      setCloudSyncMessage('已退出云同步');
    } catch (error) {
      setCloudSyncStatus('error');
      setCloudSyncMessage(getSyncErrorMessage(error));
    }
  };

  const handleCloudItemDeleted = async (itemType: CloudItemType, itemId: string) => {
    if (cloudSyncStatus === 'disabled' || cloudSyncStatus === 'signed_out') return;

    try {
      const activeDeviceId = deviceId || await getOrCreateDeviceId();
      await markCloudItemDeleted(itemType, itemId, activeDeviceId);
      setPendingCloudSync(true);
    } catch (error) {
      setCloudSyncStatus('error');
      setCloudSyncMessage(getSyncErrorMessage(error));
    }
  };

  // 导出数据
  const handleExport = async () => {
    const backup = createMonoExpireBackup({ accounts, reminders, goals });
    const data = JSON.stringify(backup, null, 2);
    const fileName = `monoexpire-sync-${new Date().toISOString().split('T')[0]}.json`;
    
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: 保存文件并分享
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'MonoExpire 同步包',
          url: result.uri,
          dialogTitle: '导出同步包'
        });
      } catch (e: any) {
        alert('导出失败: ' + (e.message || e));
      }
    } else {
      // Web: 使用下载
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 导入数据
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = parseMonoExpireBackup(event.target?.result as string);
          const counts = countSyncData(imported.data);
          const confirmMessage = imported.legacyAccountsOnly
            ? `旧版备份只包含订阅，将覆盖本机订阅数据并保留本机提醒和目标。\n\n订阅：${counts.accounts}\n\n继续导入吗？`
            : `导入同步包会用文件内容覆盖本机数据。\n\n订阅：${counts.accounts}\n提醒：${counts.reminders}\n目标：${counts.goals}\n\n继续导入吗？`;

          if (!window.confirm(confirmMessage)) {
            return;
          }

          setAccounts(sortAccounts(imported.data.accounts));

          if (!imported.legacyAccountsOnly) {
            setReminders(imported.data.reminders);
            setGoals(sortGoals(imported.data.goals));
          }

          queueCloudSync();
          setIsSyncModalOpen(false);
          alert(`同步完成：${counts.total} 条记录`);
        } catch {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Initial Load
  useEffect(() => {
    const loadAllData = async () => {
      const activeDeviceId = await getOrCreateDeviceId();
      setDeviceId(activeDeviceId);

      // 先迁移旧数据
      await migrateFromLocalStorage();
      
      // 加载订阅
      const storedAccounts = await getStoredAccounts();
      
      // 加载提醒
      const storedReminders = await getStoredReminders();
      
      // 加载目标
      const storedGoals = await getStoredGoals();
      const normalizedData = normalizeSyncData({
        accounts: storedAccounts,
        reminders: storedReminders,
        goals: storedGoals,
      });

      let dataToApply = normalizedData;

      if (!isAppwriteConfigured()) {
        setCloudSyncStatus('disabled');
        setCloudSyncMessage('缺少 Appwrite 环境变量');
      } else {
        try {
          const session = await getCloudSession();
          if (!session?.user) {
            setCloudSyncStatus('signed_out');
            setCloudSyncMessage('登录后自动同步手机和电脑数据');
          } else {
            setCloudUserEmail(session.user.email || '已登录');
            setCloudSyncStatus('syncing');
            setCloudSyncMessage('正在同步...');
            const result = await syncMonoExpireData(normalizedData, activeDeviceId);
            dataToApply = result.data;
            setCloudSyncStatus('synced');
            setCloudSyncMessage(`已同步：上传 ${result.uploadedCount}，拉取 ${result.downloadedCount}`);
          }
        } catch (error) {
          setCloudSyncStatus('error');
          setCloudSyncMessage(getSyncErrorMessage(error));
        }
      }

      setAccounts(dataToApply.accounts);
      setReminders(dataToApply.reminders);
      setGoals(dataToApply.goals);
      
      setIsLoaded(true);
    };
    loadAllData();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadNotificationPermission = async () => {
      const permission = await checkSubscriptionNotificationPermission();
      if (isMounted) {
        setNotificationPermission(permission);
      }
    };

    loadNotificationPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save on change (只在加载完成后才保存)
  useEffect(() => {
    if (isLoaded) {
      saveAccountsToStorage(accounts);
    }
  }, [accounts, isLoaded]);

  useEffect(() => {
    if (!isLoaded || notificationPermission !== 'granted') return;

    syncSubscriptionExpiryNotifications(accounts)
      .then(result => setNotificationScheduledCount(result.scheduledCount))
      .catch(error => console.error('Failed to sync subscription notifications', error));
  }, [accounts, isLoaded, notificationPermission]);

  useEffect(() => {
    if (isLoaded) {
      saveRemindersToStorage(reminders);
    }
  }, [reminders, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      saveGoalsToStorage(goals);
    }
  }, [goals, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !pendingCloudSync || !deviceId) return;
    if (cloudSyncStatus === 'disabled' || cloudSyncStatus === 'signed_out' || cloudSyncStatus === 'syncing') return;

    const timer = window.setTimeout(() => {
      setPendingCloudSync(false);
      runCloudSync(undefined, { silent: true });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [accounts, reminders, goals, isLoaded, pendingCloudSync, deviceId, cloudSyncStatus]);

  // 保存页面类型到 localStorage
  useEffect(() => {
    localStorage.setItem('monoexpire_page_type', pageType);
  }, [pageType]);

  useEffect(() => {
    localStorage.setItem('monoexpire_view_mode', viewMode);
  }, [viewMode]);

  const handleAddAccount = (data: Omit<Account, 'id'>) => {
    const newAccount = touchAccount({
      id: uuidv4(),
      ...data
    });
    setAccounts(prev => {
        const updated = [...prev, newAccount];
        return sortAccounts(updated);
    });
    queueCloudSync();
    setIsManualModalOpen(false);
  };

  const handleUpdateAccount = (data: Omit<Account, 'id'>) => {
    if (!editingAccount) return;
    setAccounts(prev => sortAccounts(prev.map(acc => 
      acc.id === editingAccount.id ? touchAccount({ ...data, id: editingAccount.id }) : acc
    )));
    queueCloudSync();
    setEditingAccount(undefined);
    setIsManualModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('确定要删除这个记录吗？')) {
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      void handleCloudItemDeleted('subscription', id);
    }
  };

  const handleEditClick = (account: Account) => {
    setEditingAccount(account);
    setIsManualModalOpen(true);
  };

  const handleSmartDataParsed = (data: ParsedAccountData) => {
    // Open manual modal pre-filled with parsed data for confirmation
    setEditingAccount(undefined); // Ensure we are in "add" mode not "edit"
    const tempAccount: Account = {
        id: '', // dummy
        type: 'subscription',
        name: data.name,
        expirationDate: data.expirationDate,
        notes: data.notes,
        provider: ''
    };
    setEditingAccount(tempAccount); 
    setIsManualModalOpen(true);
  };
  
  // Wrapper to handle save logic for both Edit and Create
  const handleSave = (data: Omit<Account, 'id'>) => {
    if (editingAccount && editingAccount.id) {
        handleUpdateAccount(data);
    } else {
        handleAddAccount(data);
    }
    setEditingAccount(undefined);
  };

  const handleCloseManual = () => {
    setIsManualModalOpen(false);
    setEditingAccount(undefined);
  };

  // ========== 提醒处理 ==========
  const handleAddReminder = (data: Omit<Reminder, 'id' | 'type'>) => {
    const newReminder = touchReminder({
      id: uuidv4(),
      type: 'reminder',
      ...data
    });
    setReminders(prev => [...prev, newReminder]);
    queueCloudSync();
    setIsReminderModalOpen(false);
  };

  const handleUpdateReminder = (data: Omit<Reminder, 'id' | 'type'>) => {
    if (!editingReminder) return;
    setReminders(prev => prev.map(r => 
      r.id === editingReminder.id ? touchReminder({ ...data, id: editingReminder.id, type: 'reminder' as const }) : r
    ));
    queueCloudSync();
    setEditingReminder(undefined);
    setIsReminderModalOpen(false);
  };

  const handleDeleteReminder = (id: string) => {
    if (window.confirm('确定要删除这个提醒吗？')) {
      setReminders(prev => prev.filter(r => r.id !== id));
      void handleCloudItemDeleted('reminder', id);
    }
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsReminderModalOpen(true);
  };

  const handleToggleReminderComplete = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setReminders(prev => prev.map(r => {
      if (r.id !== id) return r;
      const isCompletedToday = r.lastCompletedDate === today;
      return {
        ...r,
        lastCompletedDate: isCompletedToday ? undefined : today,
        updatedAt: new Date().toISOString()
      };
    }));
    queueCloudSync();
  };

  const handleSaveReminder = (data: Omit<Reminder, 'id' | 'type'>) => {
    if (editingReminder) {
      handleUpdateReminder(data);
    } else {
      handleAddReminder(data);
    }
    setEditingReminder(undefined);
  };

  const handleCloseReminder = () => {
    setIsReminderModalOpen(false);
    setEditingReminder(undefined);
  };

  // ========== 目标处理 ==========
  const handleAddGoal = (data: Omit<Goal, 'id' | 'type'>) => {
    const newGoal = touchGoal({
      id: uuidv4(),
      type: 'goal',
      ...data
    });
    setGoals(prev => {
      const updated = [...prev, newGoal];
      return sortGoals(updated);
    });
    queueCloudSync();
    setIsGoalModalOpen(false);
  };

  const handleUpdateGoal = (data: Omit<Goal, 'id' | 'type'>) => {
    if (!editingGoal) return;
    setGoals(prev => sortGoals(prev.map(g => 
      g.id === editingGoal.id ? touchGoal({ ...data, id: editingGoal.id, type: 'goal' as const }) : g
    )));
    queueCloudSync();
    setEditingGoal(undefined);
    setIsGoalModalOpen(false);
  };

  const handleDeleteGoal = (id: string) => {
    if (window.confirm('确定要删除这个目标吗？')) {
      setGoals(prev => prev.filter(g => g.id !== id));
      void handleCloudItemDeleted('goal', id);
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleToggleGoalComplete = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      return {
        ...g,
        isCompleted: !g.isCompleted,
        completedDate: !g.isCompleted ? today : undefined,
        updatedAt: new Date().toISOString()
      };
    }));
    queueCloudSync();
  };

  const handleSaveGoal = (data: Omit<Goal, 'id' | 'type'>) => {
    if (editingGoal) {
      handleUpdateGoal(data);
    } else {
      handleAddGoal(data);
    }
    setEditingGoal(undefined);
  };

  const handleCloseGoal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(undefined);
  };

  // ========== 根据页面类型打开对应的添加弹窗 ==========
  const handleAddClick = () => {
    switch (pageType) {
      case 'subscription':
        setIsManualModalOpen(true);
        break;
      case 'reminder':
        setIsReminderModalOpen(true);
        break;
      case 'goal':
        setIsGoalModalOpen(true);
        break;
    }
  };

  // ========== 获取按钮文字 ==========
  const getAddButtonText = () => {
    switch (pageType) {
      case 'subscription': return '添加订阅';
      case 'reminder': return '添加提醒';
      case 'goal': return '添加目标';
    }
  };

  // ========== 获取搜索占位符 ==========
  const getSearchPlaceholder = () => {
    switch (pageType) {
      case 'subscription': return '搜索订阅...';
      case 'reminder': return '搜索提醒...';
      case 'goal': return '搜索目标...';
    }
  };

  const getNotificationButtonTitle = () => {
    if (notificationPermission === 'granted') {
      return `已启用系统通知，当前计划 ${notificationScheduledCount} 条`;
    }
    if (notificationPermission === 'unsupported') {
      return '系统通知仅支持 iOS/Android App';
    }
    if (notificationPermission === 'denied') {
      return '通知权限已关闭';
    }
    return '启用订阅到期系统通知';
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    acc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReminders = reminders.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGoals = goals.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ========== 统计数据 ==========
  const getStats = () => {
    switch (pageType) {
      case 'subscription': {
        const expiringSoon = accounts.filter(a => {
          const days = (new Date(a.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
          return days > 0 && days <= 7;
        }).length;
        const expired = accounts.filter(a => new Date(a.expirationDate) < new Date()).length;
        return [
          { label: '总订阅数', value: accounts.length },
          { label: '即将到期', value: expiringSoon },
          { label: '已过期', value: expired, muted: true }
        ];
      }
      case 'reminder': {
        const today = new Date().toISOString().split('T')[0];
        const completedToday = reminders.filter(r => r.lastCompletedDate === today).length;
        const pending = reminders.length - completedToday;
        return [
          { label: '总提醒数', value: reminders.length },
          { label: '待完成', value: pending },
          { label: '今日已完成', value: completedToday, muted: true }
        ];
      }
      case 'goal': {
        const completed = goals.filter(g => g.isCompleted).length;
        const overdue = goals.filter(g => !g.isCompleted && new Date(g.deadline) < new Date()).length;
        const inProgress = goals.length - completed;
        return [
          { label: '总目标数', value: goals.length },
          { label: '进行中', value: inProgress },
          { label: '已完成', value: completed, muted: true }
        ];
      }
    }
  };

  const stats = getStats();
  const syncCounts = countSyncData({ accounts, reminders, goals });
  const toolbarGroupClass = "flex h-10 items-center overflow-hidden rounded-sm border border-gray-200 bg-gray-50";
  const toolbarIconButtonClass = "inline-flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2";
  const toolbarStandaloneButtonClass = `${toolbarIconButtonClass} rounded-sm border border-gray-200 bg-gray-50`;
  const mobileToolButtonClass = "inline-flex h-10 items-center justify-center border-l border-gray-200 text-gray-500 transition-colors first:border-l-0 hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black";
  const notificationButtonClass = `${toolbarStandaloneButtonClass} ${notificationPermission === 'granted' ? 'text-black' : 'text-gray-500'}`;
  const renderNotificationButton = () => (
    <button
      onClick={handleEnableSubscriptionNotifications}
      className={notificationButtonClass}
      title={getNotificationButtonTitle()}
      aria-label={getNotificationButtonTitle()}
    >
      {notificationPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
    </button>
  );
  const renderSyncButton = (className = toolbarStandaloneButtonClass) => (
    <button
      onClick={() => setIsSyncModalOpen(true)}
      className={className}
      title="电脑同步"
      aria-label="电脑同步"
    >
      <RefreshCw className="w-4 h-4" />
    </button>
  );

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-black pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-xl tracking-tighter rounded-sm">
                    M
                </div>
                <h1 className="text-2xl font-bold tracking-tight truncate">MonoExpire</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                {renderNotificationButton()}
                <PageTypeSelector value={pageType} onChange={setPageType} />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder={getSearchPlaceholder()}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-sm border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm outline-none transition-colors focus:border-black focus:bg-white"
                    />
                </div>
                <div className="grid h-10 w-full grid-cols-6 overflow-hidden rounded-sm border border-gray-200 bg-gray-50 md:hidden">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`${mobileToolButtonClass} ${viewMode === 'grid' ? 'bg-white text-black shadow-sm' : ''}`}
                        title="网格视图"
                        aria-label="网格视图"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`${mobileToolButtonClass} ${viewMode === 'list' ? 'bg-white text-black shadow-sm' : ''}`}
                        title="列表视图"
                        aria-label="列表视图"
                    >
                        <ListIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className={mobileToolButtonClass}
                        title="导出数据"
                        aria-label="导出数据"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleImport}
                        className={mobileToolButtonClass}
                        title="导入数据"
                        aria-label="导入数据"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExportToCalendar}
                        className={mobileToolButtonClass}
                        title="导出到日历"
                        aria-label="导出到日历"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                    {renderSyncButton(mobileToolButtonClass)}
                </div>
                <div className="hidden items-center gap-2 md:flex">
                <div className={toolbarGroupClass}>
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`${toolbarIconButtonClass} ${viewMode === 'grid' ? 'bg-white text-black shadow-sm' : ''}`}
                        title="网格视图"
                        aria-label="网格视图"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`${toolbarIconButtonClass} ${viewMode === 'list' ? 'bg-white text-black shadow-sm' : ''}`}
                        title="列表视图"
                        aria-label="列表视图"
                    >
                        <ListIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className={toolbarGroupClass}>
                    <button 
                        onClick={handleExport}
                        className={toolbarIconButtonClass}
                        title="导出数据"
                        aria-label="导出数据"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleImport}
                        className={toolbarIconButtonClass}
                        title="导入数据"
                        aria-label="导入数据"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
                <button 
                    onClick={handleExportToCalendar}
                    className={toolbarStandaloneButtonClass}
                    title="导出到日历"
                    aria-label="导出到日历"
                >
                    <Calendar className="w-4 h-4" />
                </button>
                {renderSyncButton()}
                <div className="hidden md:block">
                  {renderNotificationButton()}
                </div>
                <div className="hidden md:block">
                  <PageTypeSelector value={pageType} onChange={setPageType} />
                </div>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Button onClick={handleAddClick} className="flex-1 sm:flex-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black transition-all active:translate-y-[4px] active:shadow-none">
                <Plus className="w-4 h-4 mr-2" />
                {getAddButtonText()}
            </Button>
            {pageType === 'subscription' && (
              <Button variant="outline" onClick={() => setIsSmartAddOpen(true)} className="flex-1 sm:flex-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none">
                  <Command className="w-4 h-4 mr-2" />
                  AI 智能导入
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsSyncModalOpen(true)} className="flex-1 sm:flex-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none">
                <RefreshCw className="w-4 h-4 mr-2" />
                电脑同步
            </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-10">
            {stats.map((stat, index) => (
              <div key={index} className="p-2 md:p-4 border border-gray-200">
                <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold">{stat.label}</p>
                <p className={`text-xl md:text-3xl font-bold mt-0.5 md:mt-1 ${stat.muted ? 'text-gray-400' : 'text-black'}`}>
                  {stat.value}
                </p>
              </div>
            ))}
        </div>

        {/* List */}
        {pageType === 'subscription' && (
          filteredAccounts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-sm">
                <p className="text-gray-400 mb-4">暂无订阅记录</p>
                <Button variant="outline" onClick={() => setIsSmartAddOpen(true)}>尝试 AI 导入</Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6" : "flex flex-col gap-2"}>
                {filteredAccounts.map(account => (
                    <AccountCard 
                        key={account.id} 
                        account={account} 
                        onDelete={handleDeleteAccount}
                        onEdit={handleEditClick}
                        compact={viewMode === 'list'}
                    />
                ))}
            </div>
          )
        )}

        {pageType === 'reminder' && (
          filteredReminders.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-sm">
                <p className="text-gray-400 mb-4">暂无提醒</p>
                <Button variant="outline" onClick={() => setIsReminderModalOpen(true)}>添加提醒</Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6" : "flex flex-col gap-2"}>
                {filteredReminders.map(reminder => (
                    <ReminderCard 
                        key={reminder.id} 
                        reminder={reminder} 
                        onDelete={handleDeleteReminder}
                        onEdit={handleEditReminder}
                        onToggleComplete={handleToggleReminderComplete}
                        compact={viewMode === 'list'}
                    />
                ))}
            </div>
          )
        )}

        {pageType === 'goal' && (
          filteredGoals.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-sm">
                <p className="text-gray-400 mb-4">暂无目标</p>
                <Button variant="outline" onClick={() => setIsGoalModalOpen(true)}>添加目标</Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6" : "flex flex-col gap-2"}>
                {filteredGoals.map(goal => (
                    <GoalCard 
                        key={goal.id} 
                        goal={goal} 
                        onDelete={handleDeleteGoal}
                        onEdit={handleEditGoal}
                        onToggleComplete={handleToggleGoalComplete}
                        compact={viewMode === 'list'}
                    />
                ))}
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-20 py-8 text-center text-sm text-gray-400">
        <p>MonoExpire — Stay on top of your subscriptions.</p>
      </footer>

      {/* Modals */}
      <SmartAddModal 
        isOpen={isSmartAddOpen} 
        onClose={() => setIsSmartAddOpen(false)} 
        onDataParsed={handleSmartDataParsed}
      />

      <ManualModal 
        isOpen={isManualModalOpen}
        onClose={handleCloseManual}
        onSave={handleSave}
        initialData={editingAccount}
      />

      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={handleCloseReminder}
        onSave={handleSaveReminder}
        initialData={editingReminder}
      />

      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={handleCloseGoal}
        onSave={handleSaveGoal}
        initialData={editingGoal}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onExport={handleExport}
        onImport={handleImport}
        onSendOtp={handleCloudSendOtp}
        onVerifyOtp={handleCloudVerifyOtp}
        onSignOut={handleCloudSignOut}
        onSyncNow={() => runCloudSync()}
        counts={syncCounts}
        isNativePlatform={Capacitor.isNativePlatform()}
        status={cloudSyncStatus}
        statusMessage={cloudSyncMessage}
        pendingOtpEmail={pendingOtpEmail}
        userEmail={cloudUserEmail}
      />
    </div>
  );
}
