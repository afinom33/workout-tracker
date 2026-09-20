import React, { useRef, useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { Download, Upload, Cpu, CheckCircle, AlertTriangle } from 'lucide-react';

const ExportData: React.FC = () => {
  const exportData = useWorkoutStore((state) => state.exportData);
  const importData = useWorkoutStore((state) => state.importData);
  const resetData = useWorkoutStore((state) => state.resetData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = () => {
    const dataStr = exportData();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `workout_data_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const success = importData(content);
        setImportStatus(success ? 'success' : 'error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    if (window.confirm('ВЫ УВЕРЕНЫ? Это навсегда удалит ВСЮ историю тренировок, упражнения и прогресс. Рекомендуется сначала сделать экспорт!')) {
      if (window.confirm('Точно удалить все данные?')) {
        resetData();
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="mt-4">
        <h2 className="text-4xl font-extrabold tracking-tight text-gradient">Настройки</h2>
        <p className="text-textMuted mt-1">Управление данными</p>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="text-secondary" size={24} />
            <h3 className="text-xl font-bold">Анализ с ИИ</h3>
          </div>
          <p className="text-sm text-textMuted mb-4">
            Выгрузите все свои данные в формате JSON. Этот файл идеально подходит для отправки в ChatGPT, Claude или Gemini для получения персональных рекомендаций по тренировкам.
          </p>
          <button 
            onClick={handleExport}
            className="w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={20} />
            Экспорт данных (JSON)
          </button>
        </div>

        <div className="h-px bg-panelBorder w-full"></div>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <Upload className="text-textMuted" size={24} />
            <h3 className="text-xl font-bold text-textMain">Резервная копия</h3>
          </div>
          <p className="text-sm text-textMuted mb-4">
            Загрузите ранее экспортированный файл, чтобы восстановить историю тренировок на этом устройстве.
          </p>
          
          <input 
            type="file" 
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-element hover:bg-elementHover text-textMain font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Upload size={20} />
            Импорт данных
          </button>

          {importStatus === 'success' && (
            <p className="text-primary text-sm flex items-center gap-1 mt-3 justify-center animate-pulse">
              <CheckCircle size={16} /> Данные успешно загружены!
            </p>
          )}
          {importStatus === 'error' && (
            <p className="text-dangerText text-sm mt-3 text-center">
              Ошибка: Неверный формат файла.
            </p>
          )}
        </div>

        <div className="h-px bg-panelBorder w-full"></div>

        <div>
           <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-dangerText" size={24} />
            <h3 className="text-xl font-bold text-dangerText">Опасная зона</h3>
          </div>
          <p className="text-sm text-textMuted mb-4">
            Полный сброс приложения сотрет все упражнения, цели и историю тренировок.
          </p>
          <button 
            onClick={handleReset}
            className="w-full bg-danger text-dangerText border border-danger/50 hover:opacity-80 font-bold py-3 rounded-xl flex items-center justify-center transition-colors"
          >
            Сбросить все данные
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportData;
