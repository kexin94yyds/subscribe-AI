import React from 'react';
import { Trash2, Edit2, Bell, Check } from 'lucide-react';
import { Reminder, RepeatRule } from '../types';

interface ReminderCardProps {
  reminder: Reminder;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onToggleComplete?: (id: string) => void;
  compact?: boolean;
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
  onToggleComplete,
  compact = false
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
  const times = reminder.times || [reminder.time];

  if (compact) {
    return (
      <div className={`group flex min-h-[64px] items-center gap-3 border bg-white px-3 py-2 transition-colors hover:border-black ${completed ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
        <button
          onClick={() => onToggleComplete?.(reminder.id)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-black ${completed ? 'bg-black text-white' : 'bg-white text-black'}`}
          title={completed ? '取消完成' : '标记完成'}
          aria-label={completed ? `取消完成 ${reminder.name}` : `标记完成 ${reminder.name}`}
        >
          {completed ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className={`truncate text-sm font-bold ${completed ? 'line-through text-gray-400' : ''}`}>
              {reminder.name}
            </h3>
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {getRepeatText()}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-gray-500">
            <span className={`font-mono font-semibold ${completed ? 'text-gray-400' : 'text-black'}`}>
              {times.slice(0, 2).join(' / ')}
            </span>
            {times.length > 2 && <span>+{times.length - 2}</span>}
            {reminder.notes && (
              <>
                <span className="text-gray-300">/</span>
                <span className="truncate">{reminder.notes}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(reminder)}
            className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:border-black hover:bg-black hover:text-white"
            title="编辑"
            aria-label={`编辑 ${reminder.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(reminder.id)}
            className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
            title="删除"
            aria-label={`删除 ${reminder.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

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
        {(() => {
          if (times.length === 1) {
            return (
              <span className={`text-2xl md:text-4xl font-bold font-mono tracking-tighter ${completed ? 'text-gray-400' : 'text-black'}`}>
                {times[0]}
              </span>
            );
          }
          return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {times.map((t, index) => (
                <span key={index} className={`text-lg md:text-2xl font-bold font-mono tracking-tighter ${completed ? 'text-gray-400' : 'text-black'}`}>
                  {t}
                </span>
              ))}
            </div>
          );
        })()}
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
