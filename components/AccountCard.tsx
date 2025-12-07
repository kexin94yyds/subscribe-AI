import React from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Trash2, Edit2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Account, ExpiryStatus } from '../types';

interface AccountCardProps {
  account: Account;
  onDelete: (id: string) => void;
  onEdit: (account: Account) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onDelete, onEdit }) => {
  const today = new Date();
  const expiry = parseISO(account.expirationDate);
  const daysLeft = differenceInDays(expiry, today);

  let status = ExpiryStatus.Active;
  let statusColor = "border-gray-200"; // Neutral default
  let icon = <CheckCircle className="w-5 h-5" />;

  if (daysLeft < 0) {
    status = ExpiryStatus.Expired;
    statusColor = "border-black bg-stripes-gray"; 
    icon = <AlertTriangle className="w-5 h-5" />;
  } else if (daysLeft <= 7) {
    status = ExpiryStatus.ExpiringSoon;
    statusColor = "border-black";
    icon = <Clock className="w-5 h-5" />;
  }

  return (
    <div className={`group relative bg-white border-2 ${status === ExpiryStatus.Active ? 'border-gray-200 hover:border-black' : 'border-black'} p-5 transition-all duration-200 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg truncate pr-2">{account.name}</h3>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{account.provider || 'Service'}</p>
        </div>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border border-black ${status === ExpiryStatus.Expired ? 'bg-black text-white' : 'bg-white text-black'}`}>
            {icon}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-end gap-1">
            <span className={`text-4xl font-bold font-mono tracking-tighter ${daysLeft < 0 ? 'text-gray-400 line-through' : 'text-black'}`}>
                {Math.abs(daysLeft)}
            </span>
            <span className="text-sm font-medium text-gray-500 mb-1">
                {daysLeft < 0 ? '天前已过期' : '天后到期'}
            </span>
        </div>
        <p className="text-sm text-gray-400 mt-1">
            截止日期: {format(expiry, 'yyyy-MM-dd')}
        </p>
      </div>
      
      {account.notes && (
        <div className="mb-4 p-2 bg-gray-50 text-xs text-gray-600 border-l-2 border-gray-300">
            {account.notes}
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
            onClick={() => onEdit(account)}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors"
        >
            <Edit2 className="w-3 h-3" /> 编辑
        </button>
        <button 
            onClick={() => onDelete(account.id)}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
            <Trash2 className="w-3 h-3" /> 删除
        </button>
      </div>
    </div>
  );
};