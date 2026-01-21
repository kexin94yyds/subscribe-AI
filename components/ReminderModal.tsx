import React, { useState, useEffect } from 'react';
import { Reminder, RepeatRule } from '../types';
import { Button } from './Button';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Reminder, 'id' | 'type'>) => void;
  initialData?: Reminder;
}

const REPEAT_OPTIONS: { value: RepeatRule; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'custom', label: '自定义' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    time: '08:00',
    repeatRule: 'daily' as RepeatRule,
    customDays: [] as number[],
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          time: initialData.time,
          repeatRule: initialData.repeatRule,
          customDays: initialData.customDays || [],
          notes: initialData.notes || '',
        });
      } else {
        setFormData({
          name: '',
          time: '08:00',
          repeatRule: 'daily',
          customDays: [],
          notes: '',
        });
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
      time: formData.time,
      repeatRule: formData.repeatRule,
      customDays: formData.repeatRule === 'custom' ? formData.customDays : undefined,
      notes: formData.notes || undefined,
    });
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
            <label className="block text-sm font-medium mb-1">提醒时间</label>
            <input
              type="time"
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            />
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
          {formData.repeatRule === 'custom' && (
            <div>
              <label className="block text-sm font-medium mb-2">选择星期</label>
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
          <Button disabled={!formData.name || !formData.time} onClick={handleSubmit}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};
