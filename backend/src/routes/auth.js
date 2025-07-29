const express = require('express');
const { eq } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable } = require('../db/schema');
const { generateToken, authMiddleware } = require('../lib/auth');
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, dateOfBirth, gender, height, weight } = req.body;

  // Check if user already exists
  const existingUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'User already exists with this email' });
  }

  // Create new user
  const results = await db.insert(usersTable).values({
    firstName,
    lastName,
    email,
    password, // Note: In production, you should hash this
    phoneNumber,
    dateOfBirth: new Date(dateOfBirth),
    gender,
    height: parseFloat(height),
    weight: parseFloat(weight),
    role: 'user'
  });

  const userId = results[0]?.insertId || results[0]?.id;

  // Get the created user
  const newUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userID, userId));

  // Generate token
  const token = generateToken(newUser[0]);

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      userID: newUser[0].userID,
      firstName: newUser[0].firstName,
      lastName: newUser[0].lastName,
      email: newUser[0].email,
      role: newUser[0].role
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = users[0];

  // Check password (in production, use proper password hashing)
  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: 'Account is deactivated' });
  }

  // Generate token
  const token = generateToken(user);

  res.json({
    message: 'Login successful',
    token,
    user: {
      userID: user.userID,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    }
  });
}));

// Get current user profile
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = req.user;
  
  res.json({
    message: 'Profile retrieved successfully',
    data: {
      userID: user.userID,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      height: user.height,
      weight: user.weight,
      role: user.role,
      createdAt: user.createdAt
    }
  });
}));

// Update user profile
router.put('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated here
  delete updateData.userID;
  delete updateData.email;
  delete updateData.password;
  delete updateData.role;

  await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.userID, userId));

  res.json({
    message: 'Profile updated successfully'
  });
}));

// Change password
router.put('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userID;

  // Verify current password
  if (req.user.password !== currentPassword) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Update password
  await db
    .update(usersTable)
    .set({ password: newPassword })
    .where(eq(usersTable.userID, userId));

  res.json({
    message: 'Password changed successfully'
  });
}));

// Logout (client-side should remove token)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

module.exports = router;