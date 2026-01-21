import React, { useState, useEffect } from 'react';
import { Goal } from '../types';
import { Button } from './Button';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Goal, 'id' | 'type'>) => void;
  initialData?: Goal;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    deadline: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          deadline: initialData.deadline,
          notes: initialData.notes || '',
        });
      } else {
        setFormData({
          name: '',
          deadline: '',
          notes: '',
        });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSave({
      name: formData.name,
      deadline: formData.deadline,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border-2 border-black w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
        <h2 className="text-xl font-bold mb-4">
          {initialData ? '编辑目标' : '添加目标'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">目标名称</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
              placeholder="例如：完成马拉松训练"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">截止日期</label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注 (可选)</label>
            <textarea
              className="w-full p-2 border border-gray-300 focus:border-black focus:ring-0 outline-none transition-colors resize-none h-20"
              placeholder="例如：每周跑3次，每次5公里"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!formData.name || !formData.deadline} onClick={handleSubmit}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};
