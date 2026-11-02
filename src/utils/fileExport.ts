/**
 * Экспорт файлов, который работает и в обычном браузере, и в PWA,
 * установленной на iPhone/iPad (режим standalone).
 *
 * Проблема: в standalone-режиме iOS атрибут `download` и ссылки на `data:`
 * игнорируются, поэтому файл просто не скачивается. Единственный надёжный
 * способ отдать файл пользователю на iOS — системное меню «Поделиться»
 * (Web Share API), где есть пункт «Сохранить в Файлы».
 */

export type ExportResult =
  | { mode: 'share' }
  | { mode: 'download' }
  | { mode: 'cancelled' }
  /** Браузер не умеет ни скачивать, ни делиться — показываем текст для копирования. */
  | { mode: 'manual'; content: string; filename: string };

interface ExportOptions {
  content: string;
  filename: string;
  mime: string;
  title: string;
}

export const isStandalone = (): boolean => {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
};

const isAppleMobile = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const canShareFile = (file: File): boolean => {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Даём браузеру время начать скачивание, затем освобождаем память.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const exportFile = async ({ content, filename, mime, title }: ExportOptions): Promise<ExportResult> => {
  const manual: ExportResult = { mode: 'manual', content, filename };

  // В очень старых WebView конструктора File может не быть.
  if (typeof File === 'undefined') {
    return manual;
  }

  const file = new File([content], filename, { type: mime });
  const appleStandalone = isAppleMobile() && isStandalone();
  const preferShare = appleStandalone || isAppleMobile() || /Android/i.test(navigator.userAgent);

  if (preferShare && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return { mode: 'share' };
    } catch (error) {
      // Пользователь закрыл шторку «Поделиться» — это не ошибка.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { mode: 'cancelled' };
      }
      // В standalone-режиме iOS скачивание не работает — сразу отдаём текст.
      if (appleStandalone) {
        return manual;
      }
    }
  }

  // В установленном на iPhone приложении обычное скачивание бесполезно.
  if (appleStandalone) {
    return manual;
  }

  try {
    triggerDownload(file, filename);
    return { mode: 'download' };
  } catch {
    return manual;
  }
};

/** Копирование текста работает по-разному: пробуем Clipboard API, затем старый способ. */
export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Падаем в запасной вариант.
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};
