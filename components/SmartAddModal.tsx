import React, { useState } from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { parseAccountInfo } from '../services/geminiService';
import { ParsedAccountData } from '../types';

interface SmartAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataParsed: (data: ParsedAccountData) => void;
}

export const SmartAddModal: React.FC<SmartAddModalProps> = ({ isOpen, onClose, onDataParsed }) => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await parseAccountInfo(inputText);
      if (result) {
        onDataParsed(result);
        onClose();
        setInputText('');
      } else {
        setError("无法识别有效信息，请重试或手动添加。");
      }
    } catch (err) {
      setError("AI 解析失败，请检查网络或 API Key。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI 智能识别
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          粘贴您的续费邮件内容、短信通知或任何包含账号信息的文本。我们将自动提取名称和日期。
        </p>

        <textarea
          className="w-full h-32 p-3 border-2 border-gray-200 focus:border-black focus:ring-0 resize-none font-mono text-sm mb-4"
          placeholder="例如：您的 Github Copilot 订阅将于 2024年12月31日 到期..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 p-2 border border-red-100">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={!inputText.trim()}>
            识别并填充
          </Button>
        </div>
      </div>
    </div>
  );
};