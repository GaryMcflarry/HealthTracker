const { mysqlTable, int, varchar, datetime, decimal, text, boolean, time, date } = require('drizzle-orm/mysql-core');
const { sql } = require('drizzle-orm');

// Users table - matches your actual database structure
const usersTable = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  first_name: varchar('first_name', { length: 50 }),
  last_name: varchar('last_name', { length: 50 }),
  password: varchar('password', { length: 50 }),
  gender: varchar('gender', { length: 50 }),
  height: decimal('height', { precision: 10, scale: 2 }),
  weight: decimal('weight', { precision: 10, scale: 2 }),
  email: varchar('email', { length: 50 }),
  phoneNr: int('phoneNr'),
  google_oauth_id: varchar('google_oauth_id', { length: 100 }),
  fit_tokens: varchar('fit_tokens', { length: 700 }),
  device_name: varchar('device_name', { length: 100 }),
  last_sync: datetime('last_sync'),
  created_at: date('created_at').default(sql`(current_timestamp())`)
});

// Steps data table
const stepsDataTable = mysqlTable('steps_data', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  date: date('date'),
  hour: time('hour'),
  steps_count: int('steps_count')
});

// Heart rate data table  
const heartRateDataTable = mysqlTable('heart_data', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  date: date('date'),
  hour: time('hour'),
  heart_rate_bpm: int('heart_rate_bpm')
});

// Sleep data table
const sleepDataTable = mysqlTable('sleep_data', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  date: date('date'),
  bedtime_start: time('bedtime_start'),
  bedtime_end: time('bedtime_end'),
  deep_sleep_minutes: int('deep_sleep_minutes'),
  light_sleep_minutes: int('light_sleep_minutes'),
  rem_sleep_minutes: int('rem_sleep_minutes'),
  awake_minutes: int('awake_minutes'),
  sleep_efficiency_percent: int('sleep_efficiency_percent')
});

// Calorie data table
const calorieDataTable = mysqlTable('calorie_data', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  date: date('date'),
  hour: time('hour'),
  calories: int('calories')
});

// Goals table
const goalsTable = mysqlTable('goals', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  goal_type: varchar('goal_type', { length: 10 }),
  target_value: decimal('target_value', { precision: 10, scale: 2 }),
  time_period: varchar('time_period', { length: 50 }),
  icon: varchar('icon', { length: 100 })
});

// Notifications table
const notificationsTable = mysqlTable('notifications', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  title: varchar('title', { length: 50 }),
  message: varchar('message', { length: 200 }),
  notification_type: varchar('notification_type', { length: 20 }),
  icon: varchar('icon', { length: 100 })
});

// Recommendations table
const recommendationsTable = mysqlTable('recommendations', {
  id: int('id').primaryKey().autoincrement(),
  user_id: int('user_id').references(() => usersTable.id),
  recommendation_type: varchar('recommendation_type', { length: 20 }),
  title: varchar('title', { length: 50 }),
  message: varchar('message', { length: 200 }),
  suggestion: varchar('suggestion', { length: 100 }),
  trigger_type: varchar('trigger_type', { length: 20 }),
  trigger_value: int('trigger_value'),
  icon: varchar('icon', { length: 100 })
});

// Export all tables
module.exports = {
  usersTable,
  stepsDataTable,
  heartRateDataTable,
  sleepDataTable,
  calorieDataTable,
  goalsTable,
  notificationsTable,
  recommendationsTable
};