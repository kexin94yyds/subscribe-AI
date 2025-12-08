import React, { useState, useEffect } from 'react';
import { Plus, Command, LayoutGrid, List as ListIcon, Search, Download, Upload, Calendar } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { AccountCard } from './components/AccountCard';
import { Button } from './components/Button';
import { SmartAddModal } from './components/SmartAddModal';
import { getStoredAccounts, saveAccountsToStorage } from './services/storageService';
import { Account, ParsedAccountData } from './types';

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
    const [formData, setFormData] = useState({ name: '', provider: '', expirationDate: '', notes: '' });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    provider: initialData.provider || '',
                    expirationDate: initialData.expirationDate,
                    notes: initialData.notes || ''
                });
            } else {
                setFormData({ name: '', provider: '', expirationDate: '', notes: '' });
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
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button 
                        disabled={!formData.name || !formData.expirationDate}
                        onClick={() => onSave(formData)}
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // 导出到日历 (ICS格式)
  const handleExportToCalendar = () => {
    const generateICS = () => {
      const events = accounts.map(account => {
        const date = account.expirationDate.replace(/-/g, '');
        const uid = `${account.id}@monoexpire`;
        const summary = `${account.name} 订阅到期`;
        const description = account.notes ? account.notes.replace(/\n/g, '\\n') : '';
        
        return `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${date}
DTEND;VALUE=DATE:${date}
SUMMARY:${summary}
DESCRIPTION:${description}${account.provider ? ' - ' + account.provider : ''}
BEGIN:VALARM
TRIGGER:-P3D
ACTION:DISPLAY
DESCRIPTION:${account.name} 将在3天后到期
END:VALARM
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:${account.name} 明天到期
END:VALARM
END:VEVENT`;
      }).join('\n');

      return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MonoExpire//Subscription Tracker//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:MonoExpire 订阅提醒
${events}
END:VCALENDAR`;
    };

    const icsContent = generateICS();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monoexpire-calendar-${new Date().toISOString().split('T')[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导出数据
  const handleExport = () => {
    const data = JSON.stringify(accounts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monoexpire-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            const merged = [...accounts];
            imported.forEach((item: Account) => {
              if (!merged.find(a => a.id === item.id)) {
                merged.push(item);
              }
            });
            const sorted = merged.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
            setAccounts(sorted);
            alert(`成功导入 ${imported.length} 条记录`);
          }
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
    const stored = getStoredAccounts();
    // Sort by expiration date ascending (nearest first)
    const sorted = stored.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
    setAccounts(sorted);
  }, []);

  // Save on change
  useEffect(() => {
    saveAccountsToStorage(accounts);
  }, [accounts]);

  const handleAddAccount = (data: Omit<Account, 'id'>) => {
    const newAccount: Account = {
      id: uuidv4(),
      ...data
    };
    setAccounts(prev => {
        const updated = [...prev, newAccount];
        return updated.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
    });
    setIsManualModalOpen(false);
  };

  const handleUpdateAccount = (data: Omit<Account, 'id'>) => {
    if (!editingAccount) return;
    setAccounts(prev => prev.map(acc => acc.id === editingAccount.id ? { ...data, id: editingAccount.id } : acc));
    setEditingAccount(undefined);
    setIsManualModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('确定要删除这个记录吗？')) {
      setAccounts(prev => prev.filter(acc => acc.id !== id));
    }
  };

  const handleEditClick = (account: Account) => {
    setEditingAccount(account);
    setIsManualModalOpen(true);
  };

  const handleSmartDataParsed = (data: ParsedAccountData) => {
    // Open manual modal pre-filled with parsed data for confirmation
    setEditingAccount(undefined); // Ensure we are in "add" mode not "edit"
    // We need to pass this data to the manual modal. 
    // Since ManualModal takes initialData, we can use a temporary state or just repurpose editingAccount logic carefully.
    // However, clean way:
    const tempAccount: Account = {
        id: '', // dummy
        name: data.name,
        expirationDate: data.expirationDate,
        notes: data.notes,
        provider: ''
    };
    setEditingAccount(tempAccount); 
    // Wait, editingAccount implies updating an existing ID. 
    // Let's modify ManualModal usage slightly or accept that we treat it as "Edit a draft".
    // Better: split the state or reuse editingAccount but check ID.
    // Actually, let's just use the state hook inside ManualModal. 
    // To keep it simple: We will set `editingAccount` to this temp object, 
    // but when saving, if ID is empty, we treat as new.
    
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

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    acc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-black">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-xl tracking-tighter rounded-sm">
                    M
                </div>
                <h1 className="text-2xl font-bold tracking-tight">MonoExpire</h1>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="搜索订阅..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 focus:border-black outline-none transition-colors bg-gray-50 focus:bg-white text-sm"
                    />
                </div>
                <div className="flex gap-1 border border-gray-200 p-1 rounded-sm bg-gray-50">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-black'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-sm transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-black'}`}
                    >
                        <ListIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex gap-1 border border-gray-200 p-1 rounded-sm bg-gray-50">
                    <button 
                        onClick={handleImport}
                        className="p-1.5 rounded-sm transition-all text-gray-400 hover:text-black hover:bg-white"
                        title="导入数据"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleExport}
                        className="p-1.5 rounded-sm transition-all text-gray-400 hover:text-black hover:bg-white"
                        title="导出数据"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
                <button 
                    onClick={handleExportToCalendar}
                    className="p-1.5 rounded-sm transition-all text-gray-400 hover:text-black hover:bg-white border border-gray-200 bg-gray-50"
                    title="导出到日历"
                >
                    <Calendar className="w-4 h-4" />
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Button onClick={() => setIsManualModalOpen(true)} className="flex-1 sm:flex-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black transition-all active:translate-y-[4px] active:shadow-none">
                <Plus className="w-4 h-4 mr-2" />
                手动记录
            </Button>
            <Button variant="outline" onClick={() => setIsSmartAddOpen(true)} className="flex-1 sm:flex-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none">
                <Command className="w-4 h-4 mr-2" />
                AI 智能导入
            </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-semibold">总订阅数</p>
                <p className="text-3xl font-bold mt-1">{accounts.length}</p>
            </div>
            <div className="p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-semibold">即将到期 (7天内)</p>
                <p className="text-3xl font-bold mt-1 text-black">
                    {accounts.filter(a => {
                        const days = (new Date(a.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                        return days > 0 && days <= 7;
                    }).length}
                </p>
            </div>
            <div className="p-4 border border-gray-200">
                 <p className="text-xs text-gray-500 uppercase font-semibold">已过期</p>
                 <p className="text-3xl font-bold mt-1 text-gray-400">
                    {accounts.filter(a => new Date(a.expirationDate) < new Date()).length}
                 </p>
            </div>
        </div>

        {/* List */}
        {filteredAccounts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-sm">
                <p className="text-gray-400 mb-4">暂无订阅记录</p>
                <Button variant="outline" onClick={() => setIsSmartAddOpen(true)}>尝试 AI 导入</Button>
            </div>
        ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                {filteredAccounts.map(account => (
                    <AccountCard 
                        key={account.id} 
                        account={account} 
                        onDelete={handleDeleteAccount}
                        onEdit={handleEditClick}
                    />
                ))}
            </div>
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
    </div>
  );
}