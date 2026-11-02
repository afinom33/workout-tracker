import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  Copy,
  Download,
  Dumbbell,
  Pencil,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { exportFile, copyText } from '../utils/fileExport';
import {
  WORKOUT_PLAN_HEADER,
  WORKOUT_PLAN_TEMPLATE_FILENAME,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT_LABELS,
  buildWorkoutPlanCsvTemplate,
  getTodayWeekday,
  parseWorkoutPlanCsv,
  planImportKey,
} from '../utils/workoutPlanCsv';
import type {
  ParsedWorkoutPlan,
  WorkoutPlanCsvError,
  WorkoutPlanCsvWarning,
} from '../utils/workoutPlanCsv';
import type { ImportPlanMode } from '../store/useWorkoutStore';
import type { WorkoutPlan } from '../types';
import PlanEditor from './PlanEditor';

interface WorkoutPlansProps {
  onStartWorkout: () => void;
}

interface ImportPreview {
  plans: ParsedWorkoutPlan[];
  warnings: WorkoutPlanCsvWarning[];
  modes: Record<string, ImportPlanMode>;
  conflictKeys: string[];
}

interface WeekGroup {
  week: number;
  plans: WorkoutPlan[];
}

const countExercises = (plan: { exercises: { sets: unknown[] }[] }) => plan.exercises.length;

const countSets = (plan: { exercises: { sets: unknown[] }[] }) =>
  plan.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

const groupByWeek = <T extends { week: number }>(items: T[]): Array<[number, T[]]> => {
  const map = new Map<number, T[]>();
  items.forEach((item) => {
    const list = map.get(item.week) ?? [];
    list.push(item);
    map.set(item.week, list);
  });
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
};

const WorkoutPlans: React.FC<WorkoutPlansProps> = ({ onStartWorkout }) => {
  const plans = useWorkoutStore((state) => state.plans);
  const exercises = useWorkoutStore((state) => state.exercises);
  const currentSession = useWorkoutStore((state) => state.currentSession);
  const importPlans = useWorkoutStore((state) => state.importPlans);
  const startSessionFromPlan = useWorkoutStore((state) => state.startSessionFromPlan);
  const deletePlan = useWorkoutStore((state) => state.deletePlan);
  const deleteWeek = useWorkoutStore((state) => state.deleteWeek);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<WorkoutPlanCsvError[] | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [templateText, setTemplateText] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const today = getTodayWeekday();

  // Сначала недели по возрастанию, внутри недели — дни пн → вс, а при
  // одинаковом дне сохраняется порядок строк из файла (порядок в массиве plans).
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const byWeek = new Map<number, Array<{ plan: WorkoutPlan; index: number }>>();
    plans.forEach((plan, index) => {
      const list = byWeek.get(plan.week) ?? [];
      list.push({ plan, index });
      byWeek.set(plan.week, list);
    });

    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, items]) => ({
        week,
        plans: items
          .sort(
            (a, b) =>
              WEEKDAY_ORDER.indexOf(a.plan.day) - WEEKDAY_ORDER.indexOf(b.plan.day) ||
              a.index - b.index,
          )
          .map((item) => item.plan),
      }));
  }, [plans]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleTemplate = async () => {
    const content = buildWorkoutPlanCsvTemplate();
    const result = await exportFile({
      content,
      filename: WORKOUT_PLAN_TEMPLATE_FILENAME,
      mime: 'text/csv;charset=utf-8',
      title: 'Шаблон тренировок',
    });

    if (result.mode === 'manual') {
      setTemplateText(result.content ?? '');
    } else if (result.mode !== 'cancelled') {
      showToast('Шаблон сохранён. Откройте его в Excel и заполните своими тренировками.');
    }
  };

  const handleCopyTemplate = async () => {
    if (!templateText) return;
    const ok = await copyText(templateText);
    if (ok) showToast('Шаблон скопирован в буфер обмена.');
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = parseWorkoutPlanCsv(text);

      if (result.errors.length > 0) {
        setPreview(null);
        setErrors(result.errors);
        return;
      }

      const existingKeys = new Set(
        plans.map((plan) => planImportKey(plan.week, plan.name)),
      );
      const conflictKeys = Array.from(
        new Set(
          result.plans
            .map((plan) => planImportKey(plan.week, plan.name))
            .filter((key) => existingKeys.has(key)),
        ),
      );
      const modes: Record<string, ImportPlanMode> = {};
      conflictKeys.forEach((key) => {
        modes[key] = 'replace';
      });

      setErrors(null);
      setPreview({ plans: result.plans, warnings: result.warnings, modes, conflictKeys });
    };
    reader.onerror = () => {
      setErrors([{ line: 0, message: 'не удалось прочитать файл. Попробуйте сохранить его в UTF-8.' }]);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmImport = () => {
    if (!preview) return;

    const result = importPlans(preview.plans, preview.modes);
    setPreview(null);
    showToast(
      `Импортировано тренировок: ${result.imported}${
        result.createdExercises > 0 ? `, новых упражнений: ${result.createdExercises}` : ''
      }.`,
    );
  };

  const handleStart = (plan: WorkoutPlan) => {
    if (currentSession) {
      const replace = window.confirm(
        'Сейчас идёт другая тренировка. Начать новую по плану? Текущая тренировка будет потеряна.',
      );
      if (!replace) return;
    }

    const started = startSessionFromPlan(plan.id);
    if (!started) {
      showToast('В плане нет упражнений из справочника — добавьте их и попробуйте снова.');
      return;
    }
    onStartWorkout();
  };

  const handleDelete = (plan: WorkoutPlan) => {
    if (window.confirm(`Удалить тренировку «${plan.name}»? История тренировок останется.`)) {
      deletePlan(plan.id);
      showToast('Тренировка удалена.');
    }
  };

  const handleDeleteWeek = (week: number, count: number) => {
    if (
      window.confirm(
        `Удалить всю неделю ${week} (тренировок: ${count})? История тренировок останется.`,
      )
    ) {
      deleteWeek(week);
      showToast(`Неделя ${week} удалена.`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="mt-4">
        <h2 className="text-4xl font-extrabold tracking-tight text-gradient">Мои тренировки</h2>
        <p className="text-textMuted mt-1">Готовые планы по неделям: выберите и начинайте</p>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Dumbbell className="text-primary" size={24} />
          <h3 className="text-xl font-bold">Импорт из CSV</h3>
        </div>
        <p className="text-sm text-textMuted">
          Одна строка файла — один подход. Колонки:{' '}
          <span className="text-textMain">{WORKOUT_PLAN_HEADER.join(', ')}</span>. Колонки читаются
          по названию, а не по позиции. Без колонки <span className="text-textMain">week</span> все
          тренировки попадут в неделю 1. Дни недели:{' '}
          <span className="text-textMain">mon…sun</span> или{' '}
          <span className="text-textMain">Пн…Вс</span>.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={handleTemplate}
            className="w-full bg-element hover:bg-elementHover text-textMain font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={20} />
            Скачать шаблон CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Upload size={20} />
            Импортировать CSV
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {weekGroups.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center space-y-3">
          <CalendarDays className="mx-auto text-textMuted" size={32} />
          <p className="text-textMuted">
            Пока нет импортированных тренировок. Скачайте шаблон, заполните его и загрузите обратно.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {weekGroups.map((group) => (
            <section key={group.week} className="space-y-3">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <h3 className="text-xl font-bold">Неделя {group.week}</h3>
                  <p className="text-xs text-textMuted">
                    {group.plans.length}{' '}
                    {group.plans.length === 1 ? 'тренировка' : 'тренировки'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteWeek(group.week, group.plans.length)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-dangerText hover:opacity-80 transition-opacity px-2 py-1"
                >
                  <Trash2 size={14} /> Удалить неделю
                </button>
              </div>

              <div className="space-y-3">
                {group.plans.map((plan) => {
                  const isToday = plan.day === today;
                  return (
                    <div
                      key={plan.id}
                      className={`glass-panel rounded-3xl p-5 space-y-3 border ${
                        isToday ? 'border-primary/60' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold">{plan.name}</h3>
                            {isToday && (
                              <span className="text-[10px] uppercase tracking-wide bg-primary text-primaryText px-2 py-0.5 rounded-full font-bold">
                                Сегодня
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-textMuted mt-1">
                            {WEEKDAY_LABELS[plan.day]} · {countExercises(plan)}{' '}
                            {countExercises(plan) === 1 ? 'упражнение' : 'упражнений'} ·{' '}
                            {countSets(plan)} {countSets(plan) === 1 ? 'подход' : 'подходов'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-textMuted bg-element px-2 py-1 rounded-lg">
                            {WEEKDAY_SHORT_LABELS[plan.day]}
                          </span>
                          <button
                            onClick={() => setEditingPlan(plan)}
                            className="p-2 rounded-full text-textMuted hover:text-textMain hover:bg-element transition-colors"
                            aria-label={`Редактировать ${plan.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(plan)}
                            className="p-2 rounded-full text-textMuted hover:text-dangerText hover:bg-element transition-colors"
                            aria-label={`Удалить ${plan.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-textMuted line-clamp-2">
                        {plan.exercises.length > 0
                          ? plan.exercises
                              .map(
                                (exercise) =>
                                  exercises.find(
                                    (candidate) => candidate.id === exercise.exerciseId,
                                  )?.name ?? 'Удалённое упражнение',
                              )
                              .join(' · ')
                          : 'Нет упражнений'}
                      </p>

                      <button
                        onClick={() => handleStart(plan)}
                        className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                      >
                        <Play size={18} /> Начать тренировку
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-element border border-panelBorder px-4 py-3 text-sm text-textMain shadow-xl animate-in fade-in">
          {toast}
        </div>
      )}

      {errors && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-dangerText" size={22} />
                <h3 className="text-lg font-bold">Файл не импортирован</h3>
              </div>
              <button
                onClick={() => setErrors(null)}
                className="p-2 rounded-full bg-element text-textMuted hover:text-textMain transition-colors"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-textMuted">
              Найдены ошибки. Ничего не сохранено — исправьте файл и попробуйте снова.
            </p>

            <ul className="space-y-2 overflow-y-auto text-sm">
              {errors.map((error, index) => (
                <li key={`${error.line}-${index}`} className="bg-element rounded-xl px-3 py-2">
                  {error.line > 0 && <span className="font-bold">Строка {error.line}: </span>}
                  {error.message}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setErrors(null)}
              className="w-full bg-element hover:bg-elementHover text-textMain font-bold py-3 rounded-xl"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Проверьте импорт</h3>
                <p className="text-xs text-textMuted mt-1">
                  Тренировок: {preview.plans.length} · упражнений:{' '}
                  {preview.plans.reduce((total, plan) => total + countExercises(plan), 0)} · подходов:{' '}
                  {preview.plans.reduce((total, plan) => total + countSets(plan), 0)}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-2 rounded-full bg-element text-textMuted hover:text-textMain transition-colors"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {preview.warnings.length > 0 && (
              <div className="bg-element border border-panelBorder rounded-2xl p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-bold text-textMain">
                  <AlertTriangle size={14} className="text-primary" /> Предупреждения (импорт
                  возможен)
                </p>
                <ul className="space-y-1 text-xs text-textMuted">
                  {preview.warnings.map((warning, index) => (
                    <li key={`${warning.line ?? 0}-${index}`}>
                      {warning.line !== undefined && (
                        <span className="font-semibold">Строка {warning.line}: </span>
                      )}
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-4 overflow-y-auto text-sm">
              {groupByWeek(preview.plans).map(([week, weekPlans]) => (
                <li key={week} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-textMuted">
                    Неделя {week}
                  </p>
                  {weekPlans.map((plan) => {
                    const key = planImportKey(plan.week, plan.name);
                    const isConflict = preview.conflictKeys.includes(key);
                    return (
                      <div key={key} className="bg-element rounded-2xl px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{plan.name}</p>
                          <span className="text-xs text-textMuted">
                            {WEEKDAY_LABELS[plan.day]}
                          </span>
                        </div>
                        <p className="text-xs text-textMuted">
                          {countExercises(plan)} упражнений · {countSets(plan)} подходов
                        </p>

                        {isConflict && (
                          <div className="space-y-1">
                            <p className="text-[11px] text-textMuted">
                              Такая тренировка уже есть на этой неделе. Что сделать?
                            </p>
                            <div className="flex gap-2">
                              {(
                                [
                                  ['replace', 'Заменить'],
                                  ['copy', 'Оставить оба'],
                                ] as const
                              ).map(([mode, label]) => (
                                <button
                                  key={mode}
                                  onClick={() =>
                                    setPreview((current) =>
                                      current
                                        ? {
                                            ...current,
                                            modes: { ...current.modes, [key]: mode },
                                          }
                                        : current,
                                    )
                                  }
                                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                                    preview.modes[key] === mode
                                      ? 'bg-primary text-primaryText'
                                      : 'bg-background text-textMuted hover:text-textMain'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>

            <button
              onClick={handleConfirmImport}
              className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} /> Подтвердить импорт
            </button>
          </div>
        </div>
      )}

      {templateText !== null && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Шаблон CSV</h3>
                <p className="text-xs text-textMuted mt-1">
                  Скачивание недоступно. Скопируйте текст и сохраните его в файл{' '}
                  {WORKOUT_PLAN_TEMPLATE_FILENAME}.
                </p>
              </div>
              <button
                onClick={() => setTemplateText(null)}
                className="p-2 rounded-full bg-element text-textMuted hover:text-textMain transition-colors"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              readOnly
              value={templateText}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full h-48 bg-background border border-panelBorder rounded-2xl p-3 text-xs font-mono text-textMain outline-none resize-none"
            />

            <button
              onClick={handleCopyTemplate}
              className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Copy size={20} /> Скопировать шаблон
            </button>
          </div>
        </div>
      )}

      {editingPlan && <PlanEditor plan={editingPlan} onClose={() => setEditingPlan(null)} />}
    </div>
  );
};

export default WorkoutPlans;
