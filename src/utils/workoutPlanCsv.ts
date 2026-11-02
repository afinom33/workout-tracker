import type { Weekday } from '../types';

/**
 * Импорт планов тренировок из CSV и генерация шаблона.
 *
 * Одна строка файла — один плановый подход. Тренировка определяется парой
 * (week, workout_name), а порядок упражнений и подходов — колонками
 * exercise_order и set_order, а не порядком строк.
 * Колонки читаются по названию из заголовка: порядок колонок в файле не важен.
 */

export const WORKOUT_PLAN_HEADER = [
  'week',
  'workout_name',
  'day',
  'exercise_order',
  'exercise_name',
  'set_order',
  'weight_kg',
  'reps',
  'notes',
] as const;

/** Колонки, без которых файл не может быть импортирован. week и notes — необязательные. */
export const WORKOUT_PLAN_REQUIRED_COLUMNS = [
  'workout_name',
  'day',
  'exercise_order',
  'exercise_name',
  'set_order',
  'weight_kg',
  'reps',
] as const;

export const WORKOUT_PLAN_TEMPLATE_FILENAME = 'workout_template.csv';

export const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Понедельник',
  tue: 'Вторник',
  wed: 'Среда',
  thu: 'Четверг',
  fri: 'Пятница',
  sat: 'Суббота',
  sun: 'Воскресенье',
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

const WEEKDAY_ALIASES: Record<string, Weekday> = {
  mon: 'mon',
  monday: 'mon',
  пн: 'mon',
  понедельник: 'mon',
  tue: 'tue',
  tuesday: 'tue',
  вт: 'tue',
  вторник: 'tue',
  wed: 'wed',
  wednesday: 'wed',
  ср: 'wed',
  среда: 'wed',
  thu: 'thu',
  thursday: 'thu',
  чт: 'thu',
  четверг: 'thu',
  fri: 'fri',
  friday: 'fri',
  пт: 'fri',
  пятница: 'fri',
  sat: 'sat',
  saturday: 'sat',
  сб: 'sat',
  суббота: 'sat',
  sun: 'sun',
  sunday: 'sun',
  вс: 'sun',
  воскресенье: 'sun',
};

export const parseWeekday = (raw: string): Weekday | null => {
  const key = raw.trim().toLowerCase().replace(/\.$/, '');
  return WEEKDAY_ALIASES[key] ?? null;
};

/** День недели для подсветки тренировки «сегодня». */
export const getTodayWeekday = (date: Date = new Date()): Weekday =>
  WEEKDAY_ORDER[(date.getDay() + 6) % 7];

/** Сравнение названий без учёта регистра и лишних пробелов. */
const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const normalizePlanName = normalizeName;
export const normalizeExerciseName = normalizeName;

/**
 * Ключ тренировки для поиска конфликтов: одна и та же тренировка определяется
 * парой (week, workout_name). Должен совпадать с ключом в store и UI.
 */
export const planImportKey = (week: number, name: string): string =>
  `${week}|${normalizePlanName(name)}`;

export interface ParsedPlanSet {
  order: number;
  weight: number;
  reps: number;
  note?: string;
}

export interface ParsedPlanExercise {
  order: number;
  name: string;
  sets: ParsedPlanSet[];
}

export interface ParsedWorkoutPlan {
  week: number;
  name: string;
  day: Weekday;
  exercises: ParsedPlanExercise[];
}

export interface WorkoutPlanCsvError {
  /** Номер строки в файле (1 — заголовок). */
  line: number;
  message: string;
}

export interface WorkoutPlanCsvWarning {
  /** Номер строки, к которой относится предупреждение, если он известен. */
  line?: number;
  message: string;
}

export interface WorkoutPlanCsvResult {
  plans: ParsedWorkoutPlan[];
  errors: WorkoutPlanCsvError[];
  warnings: WorkoutPlanCsvWarning[];
}

interface CsvRow {
  cells: string[];
  line: number;
}

interface CsvGrid {
  rows: CsvRow[];
  error?: WorkoutPlanCsvError;
}

type HeaderMap = Record<string, number>;

interface RowRecord {
  line: number;
  week: number;
  planKey: string;
  planName: string;
  day: Weekday;
  exerciseOrder: number;
  exerciseName: string;
  setOrder: number;
  weight: number;
  reps: number;
  note?: string;
}

interface MutablePlan {
  key: string;
  week: number;
  name: string;
  day: Weekday;
  firstLine: number;
  rows: RowRecord[];
}

const DAY_HINT = 'mon, tue, wed, thu, fri, sat, sun или Пн, Вт, Ср, Чт, Пт, Сб, Вс';

/** RFC 4180-подобный разбор: кавычки, удвоенные кавычки и переводы строк внутри полей. */
const parseCsvGrid = (text: string, delimiter: string): CsvGrid => {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  let touched = false;

  const finishRow = () => {
    cells.push(field);
    const isEmpty = cells.length === 1 && cells[0].trim() === '';
    if (!isEmpty) rows.push({ cells, line: rowLine });
    cells = [];
    field = '';
    touched = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      touched = true;
      continue;
    }

    if (char === delimiter) {
      cells.push(field);
      field = '';
      touched = true;
      continue;
    }

    if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      line += 1;
      rowLine = line;
      continue;
    }

    field += char;
    touched = true;
  }

  if (inQuotes) {
    return { rows, error: { line: rowLine, message: 'незакрытая кавычка в поле.' } };
  }

  if (touched || field !== '' || cells.length > 0) finishRow();
  return { rows };
};

const KNOWN_COLUMNS = new Set<string>(WORKOUT_PLAN_HEADER);

/** Разбирает заголовок по названиям колонок. Неизвестные колонки игнорируются. */
const parseHeader = (cells: string[]): { map: HeaderMap; error?: string } => {
  const map: HeaderMap = {};

  cells.forEach((cell, index) => {
    const name = cell.trim().toLowerCase();
    if (!KNOWN_COLUMNS.has(name)) return;
    if (map[name] !== undefined) {
      map[name] = -1;
      return;
    }
    map[name] = index;
  });

  const duplicated = WORKOUT_PLAN_HEADER.filter((name) => map[name] === -1);
  if (duplicated.length > 0) {
    return { map, error: `колонка «${duplicated[0]}» встречается в заголовке дважды.` };
  }

  const missing = WORKOUT_PLAN_REQUIRED_COLUMNS.filter((name) => map[name] === undefined);
  if (missing.length > 0) {
    return { map, error: `в заголовке нет колонок: ${missing.join(', ')}.` };
  }

  return { map };
};

const hasPlanHeader = (cells: string[]): boolean => parseHeader(cells).error === undefined;

const parsePositiveInteger = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value >= 1 ? value : null;
};

const parseWeight = (raw: string): number | null => {
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const value = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

interface TemplateExercise {
  name: string;
  sets: Array<[number, number, string?]>;
}

interface TemplatePlan {
  week: number;
  name: string;
  day: Weekday;
  exercises: TemplateExercise[];
}

/** Пример на две недели: три тренировки в каждой. */
const TEMPLATE_PLANS: TemplatePlan[] = [
  {
    week: 1,
    name: 'Ноги',
    day: 'mon',
    exercises: [
      {
        name: 'Приседания со штангой',
        sets: [
          [60, 10, ''],
          [65, 8, ''],
          [70, 6, 'Тяжёлый подход'],
        ],
      },
      { name: 'Выпады с гантелями', sets: [[16, 12, ''], [18, 10, '']] },
    ],
  },
  {
    week: 1,
    name: 'Верх А',
    day: 'wed',
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          [40, 10, ''],
          [45, 8, ''],
          [50, 6, ''],
        ],
      },
      { name: 'Тяга в наклоне', sets: [[30, 12, ''], [35, 10, '']] },
    ],
  },
  {
    week: 1,
    name: 'Верх Б',
    day: 'fri',
    exercises: [
      { name: 'Жим стоя', sets: [[25, 10, ''], [30, 8, '']] },
      {
        name: 'Подтягивания',
        sets: [
          [0, 8, ''],
          [0, 8, ''],
          [0, 6, ''],
        ],
      },
    ],
  },
  {
    week: 2,
    name: 'Ноги',
    day: 'mon',
    exercises: [
      {
        name: 'Приседания со штангой',
        sets: [
          [62.5, 10, ''],
          [67.5, 8, ''],
          [72.5, 6, ''],
        ],
      },
      { name: 'Выпады с гантелями', sets: [[18, 12, ''], [20, 10, '']] },
    ],
  },
  {
    week: 2,
    name: 'Верх А',
    day: 'wed',
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          [42.5, 10, ''],
          [47.5, 8, ''],
          [52.5, 6, ''],
        ],
      },
      { name: 'Тяга в наклоне', sets: [[32.5, 12, ''], [37.5, 10, '']] },
    ],
  },
  {
    week: 2,
    name: 'Верх Б',
    day: 'fri',
    exercises: [
      { name: 'Жим стоя', sets: [[27.5, 10, ''], [32.5, 8, '']] },
      {
        name: 'Подтягивания',
        sets: [
          [0, 9, ''],
          [0, 8, ''],
          [0, 7, ''],
        ],
      },
    ],
  },
];

export const buildWorkoutPlanCsvTemplate = (): string => {
  const rows: string[][] = [Array.from(WORKOUT_PLAN_HEADER)];

  TEMPLATE_PLANS.forEach((plan) => {
    plan.exercises.forEach((exercise, exerciseIndex) => {
      exercise.sets.forEach(([weight, reps, note], setIndex) => {
        rows.push([
          String(plan.week),
          plan.name,
          plan.day,
          String(exerciseIndex + 1),
          exercise.name,
          String(setIndex + 1),
          String(weight).replace('.', ','),
          String(reps),
          note ?? '',
        ]);
      });
    });
  });

  const escapeCell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  // BOM нужен Excel, чтобы он распознал UTF-8 и не испортил кириллицу.
  return '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
};

export const parseWorkoutPlanCsv = (input: string): WorkoutPlanCsvResult => {
  const text = input.replace(/^\uFEFF/, '');
  if (text.trim() === '') {
    return {
      plans: [],
      errors: [{ line: 1, message: 'файл пуст — нет строк с данными.' }],
      warnings: [],
    };
  }

  // Заголовок однозначно подсказывает разделитель: ищем тот, при котором
  // первая строка содержит обязательные колонки.
  const attempts = [',', ';'].map((delimiter) => ({
    delimiter,
    grid: parseCsvGrid(text, delimiter),
  }));
  const chosen =
    attempts.find(({ grid }) => grid.rows.length > 0 && hasPlanHeader(grid.rows[0].cells)) ??
    attempts[0];

  if (chosen.grid.error) {
    return { plans: [], errors: [chosen.grid.error], warnings: [] };
  }

  const headerRow = chosen.grid.rows[0];
  if (!headerRow) {
    return { plans: [], errors: [{ line: 1, message: 'нет строки заголовков.' }], warnings: [] };
  }

  const header = parseHeader(headerRow.cells);
  if (header.error) {
    return {
      plans: [],
      errors: [{ line: headerRow.line, message: `неверные заголовки: ${header.error}` }],
      warnings: [],
    };
  }

  const dataRows = chosen.grid.rows.slice(1);
  if (dataRows.length === 0) {
    return {
      plans: [],
      errors: [{ line: headerRow.line + 1, message: 'нет ни одной строки с данными.' }],
      warnings: [],
    };
  }

  const errors: WorkoutPlanCsvError[] = [];
  const warnings: WorkoutPlanCsvWarning[] = [];
  const records: RowRecord[] = [];
  const headerWidth = headerRow.cells.length;
  const hasWeekColumn = header.map.week !== undefined;

  dataRows.forEach((row) => {
    if (row.cells.every((cell) => cell.trim() === '')) return;

    if (row.cells.length > headerWidth) {
      const extra = row.cells.slice(headerWidth).some((cell) => cell.trim() !== '');
      if (extra) {
        errors.push({
          line: row.line,
          message: `слишком много колонок (в заголовке ${headerWidth}).`,
        });
        return;
      }
    }

    const cell = (column: string): string => {
      const index = header.map[column];
      return index === undefined ? '' : (row.cells[index] ?? '').trim();
    };

    const weekRaw = cell('week');
    const workoutNameRaw = cell('workout_name');
    const dayRaw = cell('day');
    const exerciseOrderRaw = cell('exercise_order');
    const exerciseNameRaw = cell('exercise_name');
    const setOrderRaw = cell('set_order');
    const weightRaw = cell('weight_kg');
    const repsRaw = cell('reps');
    const notesRaw = cell('notes');

    const rowErrors: string[] = [];

    let week = 1;
    if (hasWeekColumn) {
      const parsedWeek = parsePositiveInteger(weekRaw);
      if (weekRaw === '') {
        rowErrors.push('пустой номер недели (week).');
      } else if (parsedWeek === null) {
        rowErrors.push(`week «${weekRaw}» — целое число ≥ 1.`);
      } else {
        week = parsedWeek;
      }
    }

    if (workoutNameRaw === '') rowErrors.push('пустое название тренировки (workout_name).');
    if (exerciseNameRaw === '') rowErrors.push('пустое название упражнения (exercise_name).');

    const day = parseWeekday(dayRaw);
    if (dayRaw === '') {
      rowErrors.push(`пустой день (day). Допустимо: ${DAY_HINT}.`);
    } else if (!day) {
      rowErrors.push(`неизвестный день «${dayRaw}». Допустимо: ${DAY_HINT}.`);
    }

    const exerciseOrder = parsePositiveInteger(exerciseOrderRaw);
    if (exerciseOrderRaw === '') {
      rowErrors.push('пустой exercise_order.');
    } else if (exerciseOrder === null) {
      rowErrors.push(`exercise_order «${exerciseOrderRaw}» — целое число ≥ 1.`);
    }

    const setOrder = parsePositiveInteger(setOrderRaw);
    if (setOrderRaw === '') {
      rowErrors.push('пустой set_order.');
    } else if (setOrder === null) {
      rowErrors.push(`set_order «${setOrderRaw}» — целое число ≥ 1.`);
    }

    const weight = parseWeight(weightRaw);
    if (weightRaw === '') {
      rowErrors.push('пустой вес (weight_kg).');
    } else if (weight === null) {
      rowErrors.push(`вес «${weightRaw}» — число ≥ 0 (допускается запятая).`);
    }

    const reps = parsePositiveInteger(repsRaw);
    if (repsRaw === '') {
      rowErrors.push('пустые повторы (reps).');
    } else if (reps === null) {
      rowErrors.push(`повторы «${repsRaw}» — целое число ≥ 1.`);
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((message) => errors.push({ line: row.line, message }));
      return;
    }

    records.push({
      line: row.line,
      week,
      planKey: planImportKey(week, workoutNameRaw),
      planName: workoutNameRaw,
      day: day as Weekday,
      exerciseOrder: exerciseOrder as number,
      exerciseName: exerciseNameRaw,
      setOrder: setOrder as number,
      weight: weight as number,
      reps: reps as number,
      note: notesRaw === '' ? undefined : notesRaw,
    });
  });

  const plansByKey = new Map<string, MutablePlan>();
  const seenSets = new Map<string, number>();
  const exerciseNames = new Map<string, { name: string; normalized: string }>();

  records.forEach((record) => {
    const setKey = `${record.week}|${record.planKey}|${record.exerciseOrder}|${record.setOrder}`;
    const duplicateLine = seenSets.get(setKey);
    if (duplicateLine !== undefined) {
      errors.push({
        line: record.line,
        message: `дубль: тренировка «${record.planName}» недели ${record.week}, упражнение №${record.exerciseOrder}, подход №${record.setOrder} уже задан в строке ${duplicateLine}.`,
      });
      return;
    }
    seenSets.set(setKey, record.line);

    let plan = plansByKey.get(record.planKey);
    if (!plan) {
      plan = {
        key: record.planKey,
        week: record.week,
        name: record.planName,
        day: record.day,
        firstLine: record.line,
        rows: [],
      };
      plansByKey.set(record.planKey, plan);
    } else if (plan.day !== record.day) {
      errors.push({
        line: record.line,
        message: `в неделе ${record.week} две тренировки с названием «${plan.name}»: указаны разные дни (${plan.day} и ${record.day}).`,
      });
    }

    const exerciseKey = `${record.week}|${record.planKey}|${record.exerciseOrder}`;
    const knownExercise = exerciseNames.get(exerciseKey);
    const normalizedExercise = normalizeExerciseName(record.exerciseName);
    if (knownExercise && knownExercise.normalized !== normalizedExercise) {
      errors.push({
        line: record.line,
        message: `упражнение №${record.exerciseOrder} в тренировке «${plan.name}» недели ${record.week} названо и «${knownExercise.name}», и «${record.exerciseName}».`,
      });
    } else if (!knownExercise) {
      exerciseNames.set(exerciseKey, {
        name: record.exerciseName,
        normalized: normalizedExercise,
      });
    }

    plan.rows.push(record);
  });

  const plans: ParsedWorkoutPlan[] = Array.from(plansByKey.values())
    .sort(
      (a, b) =>
        a.week - b.week ||
        WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day) ||
        a.firstLine - b.firstLine,
    )
    .map((plan) => {
      const exercisesByOrder = new Map<
        number,
        { name: string; line: number; sets: Map<number, ParsedPlanSet> }
      >();

      plan.rows.forEach((row) => {
        let exercise = exercisesByOrder.get(row.exerciseOrder);
        if (!exercise) {
          exercise = { name: row.exerciseName, line: row.line, sets: new Map() };
          exercisesByOrder.set(row.exerciseOrder, exercise);
        }
        exercise.sets.set(row.setOrder, {
          order: row.setOrder,
          weight: row.weight,
          reps: row.reps,
          note: row.note,
        });
      });

      const exerciseOrders = Array.from(exercisesByOrder.keys()).sort((a, b) => a - b);
      const maxExerciseOrder = exerciseOrders[exerciseOrders.length - 1] ?? 0;
      const missingExercises: number[] = [];
      for (let order = 1; order <= maxExerciseOrder; order += 1) {
        if (!exercisesByOrder.has(order)) missingExercises.push(order);
      }
      if (missingExercises.length > 0) {
        errors.push({
          line: plan.firstLine,
          message: `пропуск в нумерации упражнений тренировки «${plan.name}» (неделя ${plan.week}): нет упражнения №${missingExercises.join(', №')}.`,
        });
      }

      const exercises: ParsedPlanExercise[] = exerciseOrders.map((order) => {
        const exercise = exercisesByOrder.get(order)!;
        const setOrders = Array.from(exercise.sets.keys()).sort((a, b) => a - b);
        const maxSetOrder = setOrders[setOrders.length - 1] ?? 0;
        const missingSets: number[] = [];
        for (let setOrder = 1; setOrder <= maxSetOrder; setOrder += 1) {
          if (!exercise.sets.has(setOrder)) missingSets.push(setOrder);
        }
        if (missingSets.length > 0) {
          errors.push({
            line: exercise.line,
            message: `пропуск в нумерации подходов упражнения «${exercise.name}» (тренировка «${plan.name}», неделя ${plan.week}): нет подхода №${missingSets.join(', №')}.`,
          });
        }

        return {
          order,
          name: exercise.name,
          sets: setOrders.map((setOrder) => exercise.sets.get(setOrder)!),
        };
      });

      return { week: plan.week, name: plan.name, day: plan.day, exercises };
    });

  // Предупреждения не мешают импорту, но помогают заметить опечатку в неделях.
  const weeks = Array.from(new Set(plans.map((plan) => plan.week))).sort((a, b) => a - b);
  for (let index = 1; index < weeks.length; index += 1) {
    for (let missing = weeks[index - 1] + 1; missing < weeks[index]; missing += 1) {
      warnings.push({
        message: `пропущена неделя ${missing}: в файле есть недели ${weeks[index - 1]} и ${weeks[index]}.`,
      });
    }
  }

  const plansByDayWeek = new Map<string, ParsedWorkoutPlan[]>();
  plans.forEach((plan) => {
    const key = `${plan.week}|${plan.day}`;
    const list = plansByDayWeek.get(key) ?? [];
    list.push(plan);
    plansByDayWeek.set(key, list);
  });
  plansByDayWeek.forEach((sameDayPlans) => {
    if (sameDayPlans.length > 1) {
      const [first] = sameDayPlans;
      warnings.push({
        line: plansByKey.get(planImportKey(first.week, first.name))?.firstLine,
        message: `в неделе ${first.week} в один день (${WEEKDAY_LABELS[first.day]}) запланированы тренировки: ${sameDayPlans
          .map((plan) => `«${plan.name}»`)
          .join(', ')}.`,
      });
    }
  });

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER));

  return { plans, errors, warnings };
};
