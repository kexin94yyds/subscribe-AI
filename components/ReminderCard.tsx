import React from 'react';
import { Trash2, Edit2, Bell, Check } from 'lucide-react';
import { Reminder, RepeatRule } from '../types';

interface ReminderCardProps {
  reminder: Reminder;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onToggleComplete?: (id: string) => void;
}

const REPEAT_LABELS: Record<RepeatRule, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周',
  custom: '自定义',
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const ReminderCard: React.FC<ReminderCardProps> = ({ 
  reminder, 
  onDelete, 
  onEdit,
  onToggleComplete 
}) => {
  const getRepeatText = () => {
    if (reminder.repeatRule === 'custom' && reminder.customDays?.length) {
      return reminder.customDays.map(d => `周${WEEKDAYS[d]}`).join('、');
    }
    return REPEAT_LABELS[reminder.repeatRule];
  };

  const isCompletedToday = () => {
    if (!reminder.lastCompletedDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return reminder.lastCompletedDate === today;
  };

  const completed = isCompletedToday();

  return (
    <div className={`group relative bg-white border-2 ${completed ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-black'} p-3 md:p-5 transition-all duration-200 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
      <div className="flex justify-between items-start mb-2 md:mb-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-bold text-sm md:text-lg truncate pr-2 ${completed ? 'line-through text-gray-400' : ''}`}>
            {reminder.name}
          </h3>
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {getRepeatText()}
          </p>
        </div>
        <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full border border-black ${completed ? 'bg-black text-white' : 'bg-white text-black'}`}>
          {completed ? <Check className="w-3 h-3 md:w-5 md:h-5" /> : <Bell className="w-3 h-3 md:w-5 md:h-5" />}
        </div>
      </div>

      <div className="mb-2 md:mb-4">
        <div className="flex flex-wrap items-end gap-2">
          {(reminder.times || [reminder.time]).map((t, index) => (
            <span key={index} className={`text-xl md:text-3xl font-bold font-mono tracking-tighter ${completed ? 'text-gray-400' : 'text-black'}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
      
      {reminder.notes && (
        <div className="mb-2 md:mb-4 p-1.5 md:p-2 bg-gray-50 text-[10px] md:text-xs text-gray-600 border-l-2 border-gray-300 line-clamp-2">
          {reminder.notes}
        </div>
      )}

      <div className="flex gap-1 md:gap-2 mt-auto pt-2 md:pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleComplete && !completed && (
          <button 
            onClick={() => onToggleComplete(reminder.id)}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-black bg-black text-white hover:bg-gray-800 transition-colors"
          >
            <Check className="w-3 h-3" /> 完成
          </button>
        )}
        <button 
          onClick={() => onEdit(reminder)}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors"
        >
          <Edit2 className="w-3 h-3" /> 编辑
        </button>
        <button 
          onClick={() => onDelete(reminder.id)}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> 删除
        </button>
      </div>
    </div>
  );
};
