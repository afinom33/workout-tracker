import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKOUT_PLAN_HEADER,
  buildWorkoutPlanCsvTemplate,
  parseWeekday,
  parseWorkoutPlanCsv,
} from './workoutPlanCsv.ts';

/** Собирает CSV из массива объектов, чтобы тесты читались как данные. */
const csv = (rows, { header, delimiter = ',' } = {}) =>
  [header ?? WORKOUT_PLAN_HEADER.join(delimiter), ...rows.map((row) => row.join(delimiter))].join('\n');

const legsRow = (exerciseOrder, exerciseName, setOrder, weight, reps, notes = '') => [
  'Ноги',
  'mon',
  String(exerciseOrder),
  exerciseName,
  String(setOrder),
  String(weight),
  String(reps),
  notes,
];

test('шаблон содержит заголовки и примеры, которые проходят валидацию', () => {
  const template = buildWorkoutPlanCsvTemplate();

  assert.ok(template.startsWith('\uFEFF'), 'шаблон начинается с BOM для Excel');
  assert.ok(template.includes(WORKOUT_PLAN_HEADER.join(',')), 'заголовки в шаблоне');

  const { plans, errors } = parseWorkoutPlanCsv(template);
  assert.deepEqual(errors, []);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].name, 'Ноги');
  assert.equal(plans[0].day, 'mon');
  assert.equal(plans[0].exercises.length, 2);
  assert.deepEqual(
    plans[0].exercises.map((exercise) => exercise.sets.length),
    [3, 3],
  );
});

test('корректный файл: планы, упражнения и подходы упорядочены и заполнены', () => {
  const text = csv([
    legsRow(1, 'Приседания', 1, 60, 10),
    legsRow(1, 'Приседания', 2, 65, 8, 'тяжело'),
    legsRow(1, 'Приседания', 3, '"70,5"', 6),
    legsRow(2, 'Выпады', 1, 16, 12),
    ['Жим', 'wed', '1', 'Жим лёжа', '1', 40, 10, ''],
  ]);

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(errors, []);
  assert.equal(plans.length, 2);

  const legs = plans[0];
  assert.equal(legs.name, 'Ноги');
  assert.equal(legs.day, 'mon');
  assert.equal(legs.exercises[0].name, 'Приседания');
  assert.deepEqual(
    legs.exercises[0].sets.map((set) => [set.order, set.weight, set.reps]),
    [
      [1, 60, 10],
      [2, 65, 8],
      [3, 70.5, 6],
    ],
  );
  assert.equal(legs.exercises[0].sets[1].note, 'тяжело');
  assert.equal(legs.exercises[1].name, 'Выпады');
  assert.equal(plans[1].day, 'wed');
});

test('порядок строк в файле не влияет на порядок упражнений и подходов', () => {
  const text = csv([
    legsRow(2, 'Выпады', 2, 18, 10),
    legsRow(1, 'Приседания', 3, 70, 6),
    legsRow(2, 'Выпады', 1, 16, 12),
    legsRow(1, 'Приседания', 1, 60, 10),
    legsRow(1, 'Приседания', 2, 65, 8),
  ]);

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(errors, []);
  assert.deepEqual(
    plans[0].exercises.map((exercise) => exercise.name),
    ['Приседания', 'Выпады'],
  );
  assert.deepEqual(
    plans[0].exercises[1].sets.map((set) => set.order),
    [1, 2],
  );
});

test('принимает точку с запятой как разделитель', () => {
  const text = csv(
    [
      ['Ноги', 'mon', '1', 'Приседания', '1', '60', '10', ''],
      ['Ноги', 'mon', '2', 'Выпады', '1', '16', '12', ''],
    ],
    { delimiter: ';' },
  );

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(errors, []);
  assert.equal(plans[0].exercises.length, 2);
});

test('поддерживает кавычки и запятые внутри полей', () => {
  const text = [
    WORKOUT_PLAN_HEADER.join(','),
    '"Ноги, тяжёлый день",mon,1,"Приседания, со штангой",1,60,10,"""опорный"" подход"',
  ].join('\n');

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(errors, []);
  assert.equal(plans[0].name, 'Ноги, тяжёлый день');
  assert.equal(plans[0].exercises[0].name, 'Приседания, со штангой');
  assert.equal(plans[0].exercises[0].sets[0].note, '"опорный" подход');
});

test('кириллица: русские названия дней и упражнений', () => {
  const text = csv(
    [
      ['Ноги', 'понедельник', '1', 'Приседания со штангой', '1', '60', '10', ''],
      ['Ноги', 'Пн.', '1', 'Приседания со штангой', '2', '65', '8', ''],
      ['Грудь', 'Ср', '1', 'Жим лёжа', '1', '40', '10', ''],
    ],
    { header: WORKOUT_PLAN_HEADER.join(',') },
  );

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(errors, []);
  assert.deepEqual(
    plans.map((plan) => [plan.name, plan.day]),
    [
      ['Ноги', 'mon'],
      ['Грудь', 'wed'],
    ],
  );
});

test('неверные заголовки: возвращает одну понятную ошибку', () => {
  const text = csv([legsRow(1, 'Приседания', 1, 60, 10)], {
    header: 'workout,day,exercise_order,exercise_name,set_order,weight_kg,reps',
  });

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(plans, []);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 1);
  assert.match(errors[0].message, /заголовки/i);
});

test('дубли подходов: ошибка с номером строки и ссылкой на первую строку', () => {
  const text = csv([
    legsRow(1, 'Приседания', 1, 60, 10),
    legsRow(1, 'Приседания', 2, 65, 8),
    legsRow(1, 'Приседания', 1, 70, 6),
  ]);

  const { errors } = parseWorkoutPlanCsv(text);

  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 4);
  assert.match(errors[0].message, /дубль/i);
  assert.match(errors[0].message, /строке 2/);
});

test('пропуск в нумерации подходов: ошибка с номером строки', () => {
  const text = csv([legsRow(1, 'Приседания', 1, 60, 10), legsRow(1, 'Приседания', 3, 70, 6)]);

  const { errors } = parseWorkoutPlanCsv(text);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /пропуск/i);
  assert.match(errors[0].message, /№2/);
});

test('пропуск в нумерации упражнений: ошибка с номером строки', () => {
  const text = csv([legsRow(1, 'Приседания', 1, 60, 10), legsRow(3, 'Выпады', 1, 16, 12)]);

  const { errors } = parseWorkoutPlanCsv(text);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /пропуск/i);
  assert.match(errors[0].message, /№2/);
});

test('неизвестный день, пустое название и нечисловые значения собираются в список', () => {
  const text = csv([
    ['', 'mon', '1', 'Приседания', '1', '60', '10', ''],
    ['Ноги', 'праздник', '1', 'Приседания', '1', '60', '10', ''],
    ['Ноги', 'mon', '1', '', '1', '60', '10', ''],
    ['Ноги', 'mon', '1', 'Приседания', '1', 'тяжело', '10', ''],
    ['Ноги', 'mon', '1', 'Приседания', '1', '60', 'много', ''],
    ['Ноги', 'mon', 'x', 'Приседания', 'y', '', '', ''],
  ]);

  const { plans, errors } = parseWorkoutPlanCsv(text);

  assert.deepEqual(plans, []);
  assert.deepEqual(
    errors.map((error) => error.line),
    [2, 3, 4, 5, 6, 7, 7, 7, 7],
  );
  assert.match(errors[0].message, /название тренировки/i);
  assert.match(errors[1].message, /неизвестный день/i);
  assert.match(errors[2].message, /название упражнения/i);
  assert.match(errors[3].message, /вес/i);
  assert.match(errors[4].message, /повторы/i);
  assert.match(errors[5].message, /exercise_order/i);
  assert.match(errors[6].message, /set_order/i);
  assert.match(errors[7].message, /пустой вес/i);
  assert.match(errors[8].message, /пустые повторы/i);
});

test('разные дни у одной тренировки: ошибка', () => {
  const text = csv([legsRow(1, 'Приседания', 1, 60, 10), ['Ноги', 'tue', '2', 'Выпады', '1', 16, 12, '']]);

  const { errors } = parseWorkoutPlanCsv(text);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /разные дни/i);
});

test('пустой файл и файл без данных: ошибки, а не пустой результат', () => {
  assert.equal(parseWorkoutPlanCsv('').errors.length, 1);
  assert.equal(parseWorkoutPlanCsv('\uFEFF').errors.length, 1);
  assert.equal(parseWorkoutPlanCsv(csv([])).errors.length, 1);
});

test('parseWeekday понимает латиницу и кириллицу, но не выдумывает дни', () => {
  assert.equal(parseWeekday('MON'), 'mon');
  assert.equal(parseWeekday(' sunday '), 'sun');
  assert.equal(parseWeekday('Сб.'), 'sat');
  assert.equal(parseWeekday('воскресенье'), 'sun');
  assert.equal(parseWeekday('праздник'), null);
  assert.equal(parseWeekday(''), null);
});
