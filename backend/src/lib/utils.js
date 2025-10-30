const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

const formatDateTime = (date) => {
  return new Date(date).toISOString();
};

const getDateRange = (period) => {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(now.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0);
  }
  
  return { startDate, endDate: now };
};

const validateHealthData = (type, value) => {
  switch (type) {
    case 'steps':
      return value >= 0 && value <= 100000;
    case 'heartRate':
      return value >= 30 && value <= 250;
    case 'calories':
      return value >= 0 && value <= 10000;
    case 'sleep':
      return value >= 0 && value <= 24;
    default:
      return true;
  }
};

const calculateProgress = (current, target) => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

const generateRecommendation = (type, data) => {
  const recommendations = {
    steps: {
      low: "Try to take a 15-minute walk to boost your step count!",
      normal: "Great job maintaining your activity level!",
      high: "Excellent work! You're exceeding your step goals!"
    },
    heartRate: {
      low: "Your heart rate seems low. Consider light exercise.",
      normal: "Your heart rate is in a healthy range.",
      high: "Your heart rate is elevated. Consider relaxation techniques."
    },
    sleep: {
      low: "You might need more sleep. Aim for 7-9 hours per night.",
      normal: "Good sleep duration! Keep it up!",
      high: "You're getting plenty of sleep, which is great for recovery!"
    }
  };

  return recommendations[type] || {};
};

module.exports = {
  asyncHandler,
  formatDate,
  formatDateTime,
  getDateRange,
  validateHealthData,
  calculateProgress,
  generateRecommendation
};