import React, { useState, useEffect } from 'react';
import { Reminder, RepeatRule, CalendarExportDays } from '../types';
import { Button } from './Button';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Reminder, 'id' | 'type'>) => void;
  initialData?: Reminder;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const REPEAT_OPTIONS: { value: RepeatRule; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'weekly', label: '每周' },
  { value: 'custom', label: '自定义' },
];

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    times: ['08:00'] as string[],
    repeatRule: 'daily' as RepeatRule,
    customDays: [] as number[],
    calendarDays: 30 as CalendarExportDays,
    notes: '',
  });

  const [timeCount, setTimeCount] = useState(1);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const times = initialData.times || ['08:00'];
        setFormData({
          name: initialData.name,
          times: times,
          repeatRule: initialData.repeatRule,
          customDays: initialData.customDays || [],
          calendarDays: initialData.calendarDays || 30,
          notes: initialData.notes || '',
        });
        setTimeCount(times.length);
      } else {
        setFormData({
          name: '',
          times: ['08:00'],
          repeatRule: 'daily',
          customDays: [],
          calendarDays: 30,
          notes: '',
        });
        setTimeCount(1);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const toggleCustomDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day].sort(),
    }));
  };

  const handleSubmit = () => {
    onSave({
      name: formData.name,
      times: formData.times.slice(0, timeCount),
      repeatRule: formData.repeatRule,
      customDays: ['weekly', 'custom'].includes(formData.repeatRule) ? formData.customDays : undefined,
      calendarDays: formData.repeatRule !== 'none' ? formData.calendarDays : undefined,
      notes: formData.notes || undefined,
    });
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData({ ...formData, times: newTimes });
  };

  const handleTimeCountChange = (count: number) => {
    setTimeCount(count);
    // 确保 times 数组有足够的元素
    if (formData.times.length < count) {
      const newTimes = [...formData.times];
      while (newTimes.length < count) {
        newTimes.push('08:00');
      }
      setFormData({ ...formData, times: newTimes });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border-2 border-black w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
        <h2 className="text-xl font-bold mb-4">
          {initialData ? '编辑提醒' : '添加提醒'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">提醒名称</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
              placeholder="例如：喝甜菜根粉"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">提醒时间</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleTimeCountChange(count)}
                    className={`px-2 py-0.5 text-xs font-mono font-bold transition-colors ${
                      timeCount === count
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    ×{count}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: timeCount }).map((_, index) => (
                <input
                  key={index}
                  type="time"
                  className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
                  value={formData.times[index] || '08:00'}
                  onChange={(e) => updateTime(index, e.target.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">重复</label>
            <select
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors bg-white"
              value={formData.repeatRule}
              onChange={(e) =>
                setFormData({ ...formData, repeatRule: e.target.value as RepeatRule })
              }
            >
              {REPEAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {formData.repeatRule === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-2">选择周几</label>
              <div className="flex gap-2">
                {WEEKDAYS.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setFormData({ ...formData, customDays: [index] })}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      formData.customDays.includes(index)
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          {formData.repeatRule === 'custom' && (
            <div>
              <label className="block text-sm font-medium mb-2">选择星期（可多选）</label>
              <div className="flex gap-2">
                {WEEKDAYS.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleCustomDay(index)}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      formData.customDays.includes(index)
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          {formData.repeatRule !== 'none' && (
            <div>
              <label className="block text-sm font-medium mb-1">日历导出范围</label>
              <div className="flex gap-2">
                {([30, 90, 180, 365] as CalendarExportDays[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setFormData({ ...formData, calendarDays: days })}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      formData.calendarDays === days
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {days === 30 ? '30天' : days === 90 ? '3个月' : days === 180 ? '半年' : '1年'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">导出到日历时创建的事件范围</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">备注 (可选)</label>
            <textarea
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors resize-none h-20"
              placeholder="例如：跑步前30分钟"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!formData.name || formData.times.length === 0} onClick={handleSubmit}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};
