const { drizzle } = require('drizzle-orm/mysql2');
const { mysqlTable, int, varchar, datetime, decimal, text, boolean } = require('drizzle-orm/mysql-core');

// Users table
const usersTable = mysqlTable('users', {
  userID: int('userID').primaryKey().autoincrement(),
  firstName: varchar('firstName', { length: 255 }),
  lastName: varchar('lastName', { length: 255 }),
  email: varchar('email', { length: 255 }).unique(),
  password: varchar('password', { length: 255 }),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  dateOfBirth: datetime('dateOfBirth'),
  gender: varchar('gender', { length: 10 }),
  height: decimal('height', { precision: 5, scale: 2 }),
  weight: decimal('weight', { precision: 5, scale: 2 }),
  createdAt: datetime('createdAt').defaultNow(),
  isActive: boolean('isActive').default(true),
  role: varchar('role', { length: 50 }).default('user')
});

// Wearable Integration table
const wearableIntegrationTable = mysqlTable('wearableintegration', {
  integrationID: int('integrationID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  apiType: varchar('apiType', { length: 50 }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  syncLastDate: datetime('syncLastDate'),
  isActive: boolean('isActive').default(true)
});

// Goals table
const goalsTable = mysqlTable('goals', {
  goalID: int('goalID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  goalType: varchar('goalType', { length: 50 }),
  targetValue: decimal('targetValue', { precision: 10, scale: 2 }),
  currentValue: decimal('currentValue', { precision: 10, scale: 2 }).default(0),
  timeFrame: varchar('timeFrame', { length: 50 }),
  icon: varchar('icon', { length: 255 }),
  isCompleted: boolean('isCompleted').default(false),
  createdAt: datetime('createdAt').defaultNow()
});

// Profile table
const profileTable = mysqlTable('profile', {
  profileID: int('profileID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  goals: text('goals'),
  displayProfileData: text('displayProfileData')
});

// Steps Data table
const stepsDataTable = mysqlTable('stepsdata', {
  stepID: int('stepID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  date: datetime('date'),
  hour: datetime('hour'),
  steps_count: int('steps_count'),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Heart Rate Data table
const heartRateDataTable = mysqlTable('heartratedata', {
  heartRateID: int('heartRateID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  date: datetime('date'),
  hour: datetime('hour'),
  heartRateBpm: int('heartRateBpm'),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Sleep Data table
const sleepDataTable = mysqlTable('sleepdata', {
  sleepID: int('sleepID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  date: datetime('date'),
  sleepDuration: decimal('sleepDuration', { precision: 4, scale: 2 }),
  sleepQuality: varchar('sleepQuality', { length: 50 }),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Calories Data table
const caloriesDataTable = mysqlTable('caloriesdata', {
  calorieID: int('calorieID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  date: datetime('date'),
  hour: datetime('hour'),
  calories: int('calories'),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Recommendations table
const recommendationsTable = mysqlTable('recommendations', {
  recommendationID: int('recommendationID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  recommendationType: varchar('recommendationType', { length: 50 }),
  title: varchar('title', { length: 255 }),
  message: text('message'),
  suggestion: datetime('suggestion'),
  pageType: varchar('pageType', { length: 50 }),
  pageValue: int('pageValue'),
  icon: varchar('icon', { length: 255 }),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Notifications table
const notificationsTable = mysqlTable('notifications', {
  notificationID: int('notificationID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  title: varchar('title', { length: 255 }),
  message: text('message'),
  notificationType: varchar('notificationType', { length: 50 }),
  date: datetime('date'),
  providedDataAt: datetime('providedDataAt').defaultNow()
});

// Dashboard table
const dashboardTable = mysqlTable('dashboard', {
  dashboardID: int('dashboardID').primaryKey().autoincrement(),
  userID: int('userID').references(() => usersTable.userID),
  recommendations: text('recommendations'),
  stepsData: text('stepsData'),
  heartRateData: text('heartRateData'),
  sleepData: text('sleepData'),
  caloriesData: text('caloriesData'),
  displayDayData: datetime('displayDayData'),
  displayWeekData: datetime('displayWeekData'),
  displayMonthData: datetime('displayMonthData')
});

// Web App table
const webAppTable = mysqlTable('webapp', {
  webAppID: int('webAppID').primaryKey().autoincrement(),
  dashboard: text('dashboard'),
  stats: text('stats'),
  profile: text('profile'),
  notification: text('notification'),
  exportation: text('exportation'),
  displayDashboard: text('displayDashboard'),
  displayStats: text('displayStats'),
  displayProfile: text('displayProfile'),
  sendNotifications: text('sendNotifications')
});

module.exports = {
  usersTable,
  wearableIntegrationTable,
  goalsTable,
  profileTable,
  stepsDataTable,
  heartRateDataTable,
  sleepDataTable,
  caloriesDataTable,
  recommendationsTable,
  notificationsTable,
  dashboardTable,
  webAppTable
};