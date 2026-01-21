import React from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Trash2, Edit2, Target, CheckCircle, Clock } from 'lucide-react';
import { Goal } from '../types';

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onToggleComplete?: (id: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ 
  goal, 
  onDelete, 
  onEdit,
  onToggleComplete 
}) => {
  const today = new Date();
  const deadline = parseISO(goal.deadline);
  const daysLeft = differenceInDays(deadline, today);

  const isOverdue = daysLeft < 0 && !goal.isCompleted;
  const isUrgent = daysLeft <= 7 && daysLeft >= 0 && !goal.isCompleted;

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
        {onToggleComplete && (
          <button 
            onClick={() => onToggleComplete(goal.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium border transition-colors ${
              goal.isCompleted 
                ? 'border-gray-300 hover:bg-gray-100' 
                : 'border-green-500 bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <CheckCircle className="w-3 h-3" /> {goal.isCompleted ? '已完成' : '完成'}
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
