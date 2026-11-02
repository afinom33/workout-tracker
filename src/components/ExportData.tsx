import React, { useRef, useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import {
  Download,
  Upload,
  Cpu,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Copy,
  X,
  Share2,
} from 'lucide-react';
import { exportFile, copyText, isStandalone } from '../utils/fileExport';

type ExportKind = 'json' | 'csv';

interface ManualExport {
  content: string;
  filename: string;
}

const ExportData: React.FC = () => {
  const exportData = useWorkoutStore((state) => state.exportData);
  const exportCsv = useWorkoutStore((state) => state.exportCsv);
  const importData = useWorkoutStore((state) => state.importData);
  const resetData = useWorkoutStore((state) => state.resetData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualExport | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleExport = async (kind: ExportKind) => {
    if (busy) return;

    const today = new Date().toISOString().slice(0, 10);
    const filename = kind === 'json' ? `workout_data_${today}.json` : `workout_data_${today}.csv`;
    const content = kind === 'json' ? exportData() : exportCsv();

    setBusy(kind);
    try {
      const result = await exportFile({
        content,
        filename,
        mime: kind === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        title: 'Данные тренировок',
      });

      if (result.mode === 'share') {
        showToast('Готово! В меню «Поделиться» выберите «Сохранить в Файлы».');
      } else if (result.mode === 'download') {
        showToast('Файл сохраняется. Проверьте «Загрузки» или «Файлы».');
      } else if (result.mode === 'manual') {
        setCopied(false);
        setManual({ content: result.content, filename: result.filename });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!manual) return;
    const ok = await copyText(manual.content);
    setCopied(ok);
    if (ok) showToast('Данные скопированы в буфер обмена.');
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
            onClick={() => handleExport('json')}
            disabled={busy !== null}
            className="w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            <Download size={20} />
            {busy === 'json' ? 'Готовим файл…' : 'Экспорт данных (JSON)'}
          </button>
        </div>

        <div className="h-px bg-panelBorder w-full"></div>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="text-secondary" size={24} />
            <h3 className="text-xl font-bold">Таблица для Excel</h3>
          </div>
          <p className="text-sm text-textMuted mb-4">
            Все подходы в виде таблицы CSV: дата, упражнение, вес, повторы и объём. Открывается в Excel, Numbers и Google Таблицах.
          </p>
          <button
            onClick={() => handleExport('csv')}
            disabled={busy !== null}
            className="w-full bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            <FileSpreadsheet size={20} />
            {busy === 'csv' ? 'Готовим файл…' : 'Экспорт данных (CSV)'}
          </button>
        </div>

        <p className="text-xs text-textMuted flex items-start gap-2">
          <Share2 size={14} className="mt-0.5 shrink-0" />
          {isStandalone()
            ? 'На iPhone файл сохраняется через кнопку «Поделиться» → «Сохранить в Файлы». Если меню не открылось, приложение покажет данные для копирования.'
            : 'На iPhone скачивание работает через меню «Поделиться» → «Сохранить в Файлы».'}
        </p>

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

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-element border border-panelBorder px-4 py-3 text-sm text-textMain shadow-xl animate-in fade-in">
          {toast}
        </div>
      )}

      {manual && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Резервная копия</h3>
                <p className="text-xs text-textMuted mt-1">
                  Скачивание недоступно в этом режиме. Скопируйте данные и сохраните их в заметки или файл.
                </p>
              </div>
              <button
                onClick={() => setManual(null)}
                className="p-2 rounded-full bg-element text-textMuted hover:text-textMain transition-colors"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              readOnly
              value={manual.content}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-48 bg-background border border-panelBorder rounded-2xl p-3 text-xs font-mono text-textMain outline-none resize-none"
            />

            <p className="text-[11px] text-textMuted">
              {manual.filename} · {manual.content.length.toLocaleString('ru-RU')} символов
            </p>

            <button
              onClick={handleCopy}
              className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
              {copied ? 'Скопировано' : 'Скопировать всё'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportData;
