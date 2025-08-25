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

  // Input validation
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required' });
  }

  // Check if user already exists
  const existingUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'User already exists with this email' });
  }

  try {
    // Create new user with correct field names
    const results = await db.insert(usersTable).values({
      first_name: firstName,
      last_name: lastName,
      email: email,
      password: password, // Note: In production, you should hash this with bcrypt
      phoneNr: phoneNumber ? parseInt(phoneNumber.replace(/\D/g, '')) : null,
      gender: gender,
      height: height ? parseFloat(height) : null,
      weight: weight ? parseFloat(weight) : null
    });

    // Get the created user ID
    const userId = results[0].insertId;

    // Get the created user
    const newUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (newUsers.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const newUser = newUsers[0];

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        userID: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user account' });
  }
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user by email
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check password (in production, use bcrypt.compare())
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        userID: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}));

// Get current user profile
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get fresh user data from database
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    
    res.json({
      message: 'Profile retrieved successfully',
      data: {
        userID: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phoneNumber: user.phoneNr,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}));

// Update user profile
router.put('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { firstName, lastName, phoneNumber, gender, height, weight } = req.body;

  try {
    // Prepare update data with correct field names
    const updateData = {};
    
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phoneNumber) updateData.phoneNr = parseInt(phoneNumber.replace(/\D/g, ''));
    if (gender) updateData.gender = gender;
    if (height) updateData.height = parseFloat(height);
    if (weight) updateData.weight = parseFloat(weight);

    await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, userId));

    res.json({
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}));

// Change password
router.put('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  try {
    // Get current user data
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Verify current password (in production, use bcrypt.compare())
    if (user.password !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password (in production, hash with bcrypt)
    await db
      .update(usersTable)
      .set({ password: newPassword })
      .where(eq(usersTable.id, userId));

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}));

// Logout (client-side should remove token)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

module.exports = router;