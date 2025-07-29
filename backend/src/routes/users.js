const express = require('express');
const { eq } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable } = require('../db/schema');
const { authMiddleware, adminMiddleware } = require('../lib/auth');
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all users (admin only)
router.get('/', adminMiddleware, asyncHandler(async (req, res) => {
  const results = await db.select().from(usersTable);
  
  // Remove sensitive data
  const users = results.map(user => ({
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
    isActive: user.isActive,
    createdAt: user.createdAt
  }));

  res.json({
    message: 'Successfully fetched all users',
    data: users
  });
}));

// Create new user (admin only)
router.post('/', adminMiddleware, asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, dateOfBirth, gender, height, weight, role } = req.body;

  // Check if user already exists
  const existingUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'User already exists with this email' });
  }

  const results = await db.insert(usersTable).values({
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    dateOfBirth: new Date(dateOfBirth),
    gender,
    height: parseFloat(height),
    weight: parseFloat(weight),
    role: role || 'user'
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created user ${id}`,
    data: id
  });
}));

// Get user by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requestingUserId = req.user.userID;
  const isAdmin = req.user.role === 'admin';

  // Users can only view their own profile unless they're admin
  if (!isAdmin && parseInt(id) !== requestingUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const results = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userID, parseInt(id)));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `User with id ${id} not found` });
  }

  const user = results[0];
  
  // Remove password from response
  const userResponse = {
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
    isActive: user.isActive,
    createdAt: user.createdAt
  };
  
  res.json({
    message: `Successfully fetched user ${user.userID}`,
    data: userResponse
  });
}));

// Update user by ID
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requestingUserId = req.user.userID;
  const isAdmin = req.user.role === 'admin';

  // Users can only update their own profile unless they're admin
  if (!isAdmin && parseInt(id) !== requestingUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updateData = { ...req.body };
  
  // Non-admin users cannot change role or email
  if (!isAdmin) {
    delete updateData.role;
    delete updateData.email;
  }

  // Remove userID from update data
  delete updateData.userID;

  await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.userID, parseInt(id)));
  
  res.json({
    message: `Successfully updated user ${id}`
  });
}));

// Delete user by ID (admin only)
router.delete('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Prevent admin from deleting themselves
  if (parseInt(id) === req.user.userID) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  await db
    .delete(usersTable)
    .where(eq(usersTable.userID, parseInt(id)));
  
  res.json({
    message: `Successfully deleted user ${id}`
  });
}));

// Deactivate/Activate user (admin only)
router.patch('/:id/status', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  await db
    .update(usersTable)
    .set({ isActive })
    .where(eq(usersTable.userID, parseInt(id)));

  res.json({
    message: `Successfully ${isActive ? 'activated' : 'deactivated'} user ${id}`
  });
}));

module.exports = router;