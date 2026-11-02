import type { Weekday } from '../types';

/**
 * Импорт планов тренировок из CSV и генерация шаблона.
 *
 * Одна строка файла — один плановый подход. Порядок упражнений и подходов
 * задаётся колонками exercise_order и set_order, а не порядком строк.
 * Здесь же лежат подписи дней недели и разбор дня — это единый источник
 * правды для CSV и интерфейса, чтобы не расходились форматы.
 */

export const WORKOUT_PLAN_HEADER = [
  'workout_name',
  'day',
  'exercise_order',
  'exercise_name',
  'set_order',
  'weight_kg',
  'reps',
  'notes',
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
  name: string;
  day: Weekday;
  exercises: ParsedPlanExercise[];
}

export interface WorkoutPlanCsvError {
  /** Номер строки в файле (1 — заголовок). */
  line: number;
  message: string;
}

export interface WorkoutPlanCsvResult {
  plans: ParsedWorkoutPlan[];
  errors: WorkoutPlanCsvError[];
}

interface CsvRow {
  cells: string[];
  line: number;
}

interface CsvGrid {
  rows: CsvRow[];
  error?: WorkoutPlanCsvError;
}

interface RowRecord {
  line: number;
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

const matchesHeader = (cells: string[]): boolean =>
  cells.length === WORKOUT_PLAN_HEADER.length &&
  WORKOUT_PLAN_HEADER.every((name, index) => cells[index].trim().toLowerCase() === name);

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

export const buildWorkoutPlanCsvTemplate = (): string => {
  const rows: string[][] = [
    Array.from(WORKOUT_PLAN_HEADER),
    ['Ноги', 'mon', '1', 'Приседания со штангой', '1', '60', '10', ''],
    ['Ноги', 'mon', '1', 'Приседания со штангой', '2', '65', '8', ''],
    ['Ноги', 'mon', '1', 'Приседания со штангой', '3', '70', '6', 'Тяжёлый подход'],
    ['Ноги', 'mon', '2', 'Выпады с гантелями', '1', '16', '12', ''],
    ['Ноги', 'mon', '2', 'Выпады с гантелями', '2', '16', '12', ''],
    ['Ноги', 'mon', '2', 'Выпады с гантелями', '3', '18', '10', ''],
  ];

  const escapeCell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  // BOM нужен Excel, чтобы он распознал UTF-8 и не испортил кириллицу.
  return '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
};

export const parseWorkoutPlanCsv = (input: string): WorkoutPlanCsvResult => {
  const text = input.replace(/^\uFEFF/, '');
  if (text.trim() === '') {
    return { plans: [], errors: [{ line: 1, message: 'файл пуст — нет строк с данными.' }] };
  }

  // Заголовок однозначно подсказывает разделитель: ищем тот, при котором
  // первая строка совпадает с ожидаемыми колонками.
  const attempts = [',', ';'].map((delimiter) => ({
    delimiter,
    grid: parseCsvGrid(text, delimiter),
  }));
  const chosen =
    attempts.find(({ grid }) => grid.rows.length > 0 && matchesHeader(grid.rows[0].cells)) ??
    attempts[0];

  if (chosen.grid.error) {
    return { plans: [], errors: [chosen.grid.error] };
  }

  const headerRow = chosen.grid.rows[0];
  if (!headerRow) {
    return { plans: [], errors: [{ line: 1, message: 'нет строки заголовков.' }] };
  }

  if (!matchesHeader(headerRow.cells)) {
    return {
      plans: [],
      errors: [
        {
          line: headerRow.line,
          message: `неверные заголовки. Ожидается: ${WORKOUT_PLAN_HEADER.join(', ')}.`,
        },
      ],
    };
  }

  const dataRows = chosen.grid.rows.slice(1);
  if (dataRows.length === 0) {
    return {
      plans: [],
      errors: [{ line: headerRow.line + 1, message: 'нет ни одной строки с данными.' }],
    };
  }

  const errors: WorkoutPlanCsvError[] = [];
  const records: RowRecord[] = [];

  dataRows.forEach((row) => {
    const cells = row.cells.slice(0, WORKOUT_PLAN_HEADER.length);
    while (cells.length < WORKOUT_PLAN_HEADER.length) cells.push('');

    const [workoutNameRaw, dayRaw, exerciseOrderRaw, exerciseNameRaw, setOrderRaw, weightRaw, repsRaw, notesRaw] =
      cells.map((cell) => cell.trim());

    if (row.cells.length > WORKOUT_PLAN_HEADER.length) {
      const extra = row.cells.slice(WORKOUT_PLAN_HEADER.length).some((cell) => cell.trim() !== '');
      if (extra) {
        errors.push({
          line: row.line,
          message: `слишком много колонок (ожидается ${WORKOUT_PLAN_HEADER.length}).`,
        });
        return;
      }
    }

    if (workoutNameRaw === '' && exerciseNameRaw === '' && weightRaw === '' && repsRaw === '') {
      return;
    }

    const rowErrors: string[] = [];

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
      planKey: normalizePlanName(workoutNameRaw),
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
    const setKey = `${record.planKey}|${record.exerciseOrder}|${record.setOrder}`;
    const duplicateLine = seenSets.get(setKey);
    if (duplicateLine !== undefined) {
      errors.push({
        line: record.line,
        message: `дубль: тренировка «${record.planName}», упражнение №${record.exerciseOrder}, подход №${record.setOrder} уже задан в строке ${duplicateLine}.`,
      });
      return;
    }
    seenSets.set(setKey, record.line);

    let plan = plansByKey.get(record.planKey);
    if (!plan) {
      plan = {
        key: record.planKey,
        name: record.planName,
        day: record.day,
        firstLine: record.line,
        rows: [],
      };
      plansByKey.set(record.planKey, plan);
    } else if (plan.day !== record.day) {
      errors.push({
        line: record.line,
        message: `в тренировке «${plan.name}» указаны разные дни: ${plan.day} и ${record.day}.`,
      });
    }

    const exerciseKey = `${record.planKey}|${record.exerciseOrder}`;
    const knownExercise = exerciseNames.get(exerciseKey);
    const normalizedExercise = normalizeExerciseName(record.exerciseName);
    if (knownExercise && knownExercise.normalized !== normalizedExercise) {
      errors.push({
        line: record.line,
        message: `упражнение №${record.exerciseOrder} в тренировке «${plan.name}» названо и «${knownExercise.name}», и «${record.exerciseName}».`,
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
    .sort((a, b) => a.firstLine - b.firstLine)
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
          message: `пропуск в нумерации упражнений тренировки «${plan.name}»: нет упражнения №${missingExercises.join(', №')}.`,
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
            message: `пропуск в нумерации подходов упражнения «${exercise.name}» (тренировка «${plan.name}»): нет подхода №${missingSets.join(', №')}.`,
          });
        }

        return {
          order,
          name: exercise.name,
          sets: setOrders.map((setOrder) => exercise.sets.get(setOrder)!),
        };
      });

      return { name: plan.name, day: plan.day, exercises };
    });

  errors.sort((a, b) => a.line - b.line);

  return { plans, errors };
};
