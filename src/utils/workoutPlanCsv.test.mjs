import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WORKOUT_PLAN_HEADER,
  buildWorkoutPlanCsvTemplate,
  parseWeekday,
  parseWorkoutPlanCsv,
} from './workoutPlanCsv.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', '..', 'tests', 'fixtures', 'workout_template.csv');
const fixture = readFileSync(fixturePath, 'utf8');

const csv = (rows, header = WORKOUT_PLAN_HEADER, delimiter = ',') =>
  [header.join(delimiter), ...rows.map((row) => row.join(delimiter))].join('\n');

const planAt = (result, week, name) =>
  result.plans.find((plan) => plan.week === week && plan.name === name);

test('шаблон: BOM, CRLF, 9 колонок и 6 тренировок по двум неделям', () => {
  const text = buildWorkoutPlanCsvTemplate();

  assert.ok(text.startsWith('\uFEFF'));
  assert.ok(text.includes('\r\n'));
  assert.equal(text.split('\r\n')[0].replace('\uFEFF', ''), WORKOUT_PLAN_HEADER.join(','));

  const result = parseWorkoutPlanCsv(text);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.plans.length, 6);
  assert.deepEqual(
    result.plans.map((plan) => plan.week),
    [1, 1, 1, 2, 2, 2],
  );
});

test('эталонный файл: 6 планов в порядке неделя 1 → неделя 2, день пн → вс', () => {
  const result = parseWorkoutPlanCsv(fixture);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.plans.map((plan) => `${plan.week}:${plan.name}:${plan.day}`),
    [
      '1:Ноги:mon',
      '1:Верх А:wed',
      '1:Верх Б:fri',
      '2:Ноги:mon',
      '2:Верх А:wed',
      '2:Верх Б:fri',
    ],
  );

  const legs = planAt(result, 1, 'Ноги');
  assert.equal(legs.exercises.length, 2);
  assert.equal(legs.exercises[0].name, 'Приседания');
  assert.equal(legs.exercises[0].sets.length, 3);
  assert.deepEqual(
    legs.exercises[0].sets.map((set) => [set.weight, set.reps]),
    [
      [60, 8],
      [65, 6],
      [70, 5],
    ],
  );

  const upperA = planAt(result, 1, 'Верх А');
  assert.equal(upperA.exercises[0].sets[1].weight, 52.5);

  const upperB = planAt(result, 1, 'Верх Б');
  assert.equal(upperB.exercises[1].sets[1].note, 'с резинкой');
});

test('перемешанные между неделями строки дают тот же порядок', () => {
  const [header, ...rows] = fixture.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const shuffled = [header, ...rows.reverse()].join('\n');
  const result = parseWorkoutPlanCsv(shuffled);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.plans.map((plan) => `${plan.week}:${plan.name}`),
    ['1:Ноги', '1:Верх А', '1:Верх Б', '2:Ноги', '2:Верх А', '2:Верх Б'],
  );
});

test('старый файл без колонки week попадает в неделю 1', () => {
  const header = [
    'workout_name',
    'day',
    'exercise_order',
    'exercise_name',
    'set_order',
    'weight_kg',
    'reps',
    'notes',
  ];
  const result = parseWorkoutPlanCsv(
    csv(
      [
        ['Спина', 'tue', '1', 'Тяга', '1', '50', '8', ''],
        ['Спина', 'tue', '1', 'Тяга', '2', '55', '6', ''],
        ['Спина', 'tue', '2', 'Подтягивания', '1', '0', '10', ''],
      ],
      header,
    ),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].week, 1);
  assert.equal(result.plans[0].name, 'Спина');
  assert.equal(result.plans[0].exercises.length, 2);
});

test('колонки читаются по названию, а не по позиции', () => {
  const header = [
    'workout_name',
    'week',
    'day',
    'exercise_name',
    'exercise_order',
    'set_order',
    'reps',
    'weight_kg',
    'notes',
  ];
  const result = parseWorkoutPlanCsv(
    csv(
      [
        ['Ноги', '1', 'mon', 'Приседания', '1', '1', '8', '60', ''],
        ['Ноги', '1', 'mon', 'Приседания', '1', '2', '6', '65', ''],
      ],
      header,
    ),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans[0].exercises[0].name, 'Приседания');
  assert.deepEqual(
    result.plans[0].exercises[0].sets.map((set) => [set.weight, set.reps]),
    [
      [60, 8],
      [65, 6],
    ],
  );
});

test('запятая как десятичный разделитель внутри кавычек', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '"70,5"', '5', ''],
      ['1', 'Ноги', 'mon', '1', 'Приседания', '2', '"72,5"', '5', ''],
    ]),
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.plans[0].exercises[0].sets.map((set) => set.weight),
    [70.5, 72.5],
  );
});

test('разделитель ; определяется автоматически', () => {
  const text = [
    WORKOUT_PLAN_HEADER.join(';'),
    '1;Ноги;mon;1;Приседания;1;70,5;5;',
    '1;Ноги;mon;1;Приседания;2;75;5;',
  ].join('\n');
  const result = parseWorkoutPlanCsv(text);

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans[0].exercises[0].sets[0].weight, 70.5);
});

test('кавычки, запятые и переводы строк внутри полей', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', '"разминка, лёгкий вес"'],
      ['1', 'Ноги', 'mon', '1', 'Приседания', '2', '65', '6', '"после\nотдыха"'],
    ]),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans[0].exercises[0].sets[0].note, 'разминка, лёгкий вес');
  assert.equal(result.plans[0].exercises[0].sets[1].note, 'после\nотдыха');
});

test('кириллические дни недели', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'Пн', '1', 'Приседания', '1', '60', '8', ''],
      ['1', 'Верх', 'Ср', '1', 'Жим', '1', '40', '10', ''],
    ]),
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.plans.map((plan) => plan.day),
    ['mon', 'wed'],
  );
});

test('неверные заголовки: понятная ошибка, планов нет', () => {
  const result = parseWorkoutPlanCsv('foo,bar\n1,2');

  assert.equal(result.plans.length, 0);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((error) => /заголов/i.test(error.message)));
});

test('дубль week + workout_name + exercise_order + set_order — ошибка', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', ''],
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '65', '6', ''],
    ]),
  );

  assert.ok(result.errors.some((error) => /дубл/i.test(error.message)));
  assert.ok(result.errors.some((error) => error.line === 3));
});

test('одно название тренировки в одной неделе на разных днях — ошибка', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', ''],
      ['1', 'Ноги', 'wed', '1', 'Приседания', '1', '60', '8', ''],
    ]),
  );

  assert.ok(result.errors.length > 0);
});

test('две тренировки в один день одной недели — предупреждение, импорт возможен', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', ''],
      ['1', 'Спина', 'mon', '1', 'Тяга', '1', '50', '8', ''],
    ]),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans.length, 2);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings.some((warning) => /день|дн/i.test(warning.message)));
});

test('пропуск недели — предупреждение, а не ошибка', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', ''],
      ['3', 'Спина', 'wed', '1', 'Тяга', '1', '50', '8', ''],
    ]),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.plans.length, 2);
  assert.ok(result.warnings.some((warning) => /недел/i.test(warning.message)));
});

test('некорректный номер недели — ошибка', () => {
  const result = parseWorkoutPlanCsv(
    csv([['0', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', '']]),
  );

  assert.equal(result.plans.length, 0);
  assert.ok(result.errors.length > 0);
});

test('пропуски в нумерации упражнений и подходов — ошибки', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', '60', '8', ''],
      ['1', 'Ноги', 'mon', '1', 'Приседания', '3', '65', '6', ''],
      ['1', 'Ноги', 'mon', '3', 'Выпады', '1', '20', '10', ''],
    ]),
  );

  assert.ok(result.errors.some((error) => /подход/i.test(error.message)));
  assert.ok(result.errors.some((error) => /упражнен/i.test(error.message)));
});

test('нечисловой вес и повторения — ошибки с номерами строк', () => {
  const result = parseWorkoutPlanCsv(
    csv([
      ['1', 'Ноги', 'mon', '1', 'Приседания', '1', 'тяжело', '8', ''],
      ['1', 'Ноги', 'mon', '1', 'Приседания', '2', '60', '0', ''],
    ]),
  );

  assert.equal(result.plans.length, 0);
  assert.ok(result.errors.some((error) => error.line === 2));
  assert.ok(result.errors.some((error) => error.line === 3));
});

test('parseWeekday понимает английские и русские варианты', () => {
  assert.equal(parseWeekday('mon'), 'mon');
  assert.equal(parseWeekday(' Monday '), 'mon');
  assert.equal(parseWeekday('Пн.'), 'mon');
  assert.equal(parseWeekday('вс'), 'sun');
  assert.equal(parseWeekday('Пт'), 'fri');
  assert.equal(parseWeekday('не день'), null);
});
