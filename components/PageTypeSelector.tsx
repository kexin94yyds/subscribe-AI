import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { PageType } from '../types';

interface PageTypeSelectorProps {
  value: PageType;
  onChange: (type: PageType) => void;
}

const PAGE_TYPE_CONFIG: Record<PageType, { label: string; icon: string }> = {
  subscription: { label: '订阅', icon: '📋' },
  reminder: { label: '提醒', icon: '⏰' },
  goal: { label: '目标', icon: '🎯' },
};

export const PageTypeSelector: React.FC<PageTypeSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = PAGE_TYPE_CONFIG[value];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-sm font-medium"
      >
        <span>{currentConfig.icon}</span>
        <span>{currentConfig.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[140px]">
          {(Object.keys(PAGE_TYPE_CONFIG) as PageType[]).map((type) => {
            const config = PAGE_TYPE_CONFIG[type];
            const isSelected = type === value;
            return (
              <button
                key={type}
                onClick={() => {
                  onChange(type);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${
                  isSelected 
                    ? 'bg-black text-white' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <span>{config.icon}</span>
                <span className="font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
