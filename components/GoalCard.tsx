import React from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Trash2, Edit2, Target, CheckCircle, Clock } from 'lucide-react';
import { Goal } from '../types';

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onToggleComplete?: (id: string) => void;
  compact?: boolean;
}

export const GoalCard: React.FC<GoalCardProps> = ({ 
  goal, 
  onDelete, 
  onEdit,
  onToggleComplete,
  compact = false
}) => {
  const today = new Date();
  const deadline = parseISO(goal.deadline);
  const daysLeft = differenceInDays(deadline, today);

  const isOverdue = daysLeft < 0 && !goal.isCompleted;
  const isUrgent = daysLeft <= 7 && daysLeft >= 0 && !goal.isCompleted;

  if (compact) {
    return (
      <div className={`group flex min-h-[64px] items-center gap-3 border bg-white px-3 py-2 transition-colors hover:border-black ${
        goal.isCompleted
          ? 'border-gray-200 opacity-60'
          : isOverdue || isUrgent
            ? 'border-black'
            : 'border-gray-200'
      }`}>
        <button
          onClick={() => onToggleComplete?.(goal.id)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-black ${goal.isCompleted ? 'bg-black text-white' : 'bg-white text-black'}`}
          title={goal.isCompleted ? '取消完成' : '标记完成'}
          aria-label={goal.isCompleted ? `取消完成 ${goal.name}` : `标记完成 ${goal.name}`}
        >
          {goal.isCompleted
            ? <CheckCircle className="h-4 w-4" />
            : isOverdue
              ? <Clock className="h-4 w-4" />
              : <Target className="h-4 w-4" />
          }
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className={`truncate text-sm font-bold ${goal.isCompleted ? 'line-through text-gray-400' : ''}`}>
              {goal.name}
            </h3>
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              目标
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-gray-500">
            {goal.isCompleted ? (
              <span className="font-semibold text-gray-400">已完成</span>
            ) : (
              <>
                <span className={`font-semibold ${isOverdue ? 'text-gray-400' : 'text-black'}`}>
                  {Math.abs(daysLeft)}
                </span>
                <span>{isOverdue ? '天前截止' : '天后截止'}</span>
                <span className="text-gray-300">/</span>
                <span className="truncate">{format(deadline, 'yyyy-MM-dd')}</span>
              </>
            )}
            {goal.notes && (
              <>
                <span className="text-gray-300">/</span>
                <span className="truncate">{goal.notes}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:border-black hover:bg-black hover:text-white"
            title="编辑"
            aria-label={`编辑 ${goal.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
            title="删除"
            aria-label={`删除 ${goal.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative bg-white border-2 ${
      goal.isCompleted 
        ? 'border-gray-200 opacity-60' 
        : isOverdue 
          ? 'border-black bg-stripes-gray'
          : isUrgent
            ? 'border-black'
            : 'border-gray-200 hover:border-black'
    } p-3 md:p-5 transition-all duration-200 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
      <div className="flex justify-between items-start mb-2 md:mb-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-bold text-sm md:text-lg truncate pr-2 ${goal.isCompleted ? 'line-through text-gray-400' : ''}`}>
            {goal.name}
          </h3>
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider font-semibold">
            目标
          </p>
        </div>
        <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full border border-black ${
          goal.isCompleted ? 'bg-black text-white' : 'bg-white text-black'
        }`}>
          {goal.isCompleted 
            ? <CheckCircle className="w-3 h-3 md:w-5 md:h-5" /> 
            : isOverdue 
              ? <Clock className="w-3 h-3 md:w-5 md:h-5" />
              : <Target className="w-3 h-3 md:w-5 md:h-5" />
          }
        </div>
      </div>

      <div className="mb-2 md:mb-4">
        {goal.isCompleted ? (
          <div className="flex items-end gap-1">
            <span className="text-sm md:text-lg font-medium text-gray-400">
              已完成
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className={`text-2xl md:text-4xl font-bold font-mono tracking-tighter ${isOverdue ? 'text-gray-400' : 'text-black'}`}>
                {Math.abs(daysLeft)}
              </span>
              <span className="text-[10px] md:text-sm font-medium text-gray-500 mb-0.5 md:mb-1">
                {isOverdue ? '天前截止' : '天后截止'}
              </span>
            </div>
            <p className="text-[10px] md:text-sm text-gray-400 mt-0.5 md:mt-1">
              截止日期: {format(deadline, 'yyyy-MM-dd')}
            </p>
          </>
        )}
      </div>
      
      {goal.notes && (
        <div className="mb-2 md:mb-4 p-1.5 md:p-2 bg-gray-50 text-[10px] md:text-xs text-gray-600 border-l-2 border-gray-300 line-clamp-2">
          {goal.notes}
        </div>
      )}

      <div className="flex gap-1 md:gap-2 mt-auto pt-2 md:pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleComplete && !goal.isCompleted && (
          <button 
            onClick={() => onToggleComplete(goal.id)}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-black bg-black text-white hover:bg-gray-800 transition-colors"
          >
            <CheckCircle className="w-3 h-3" /> 完成
          </button>
        )}
        <button 
          onClick={() => onEdit(goal)}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors"
        >
          <Edit2 className="w-3 h-3" /> 编辑
        </button>
        <button 
          onClick={() => onDelete(goal.id)}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border border-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> 删除
        </button>
      </div>
    </div>
  );
};
