
const express = require('express');
const { eq } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable } = require('../db/schema'); // Make sure this schema includes fit_tokens, last_sync, device_name, google_oauth_id
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

// --- Public Routes ---

// Create new user (Publicly accessible for registration)
router.post('/', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, dateOfBirth, gender, height, weight, role } = req.body;

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

  const results = await db.insert(usersTable).values({
    firstName,
    lastName,
    email,
    password, // WARNING: Password should be hashed with bcrypt
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
    data: { userId: id } // Return just the ID for simplicity here
  });
}));

// Get user by ID (Publicly accessible)
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const userIdToFind = parseInt(id);

  if (isNaN(userIdToFind) || userIdToFind <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // Select ALL necessary user details, and explicitly alias them
  // to the desired JavaScript camelCase property names.
  const results = await db
    .select({
      // Explicitly alias DB snake_case columns to JS camelCase properties
      userID: usersTable.id, // Map DB 'id' to JS 'userID'
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      email: usersTable.email,
      phoneNr: usersTable.phoneNr, // Map DB 'phoneNr' to JS 'phoneNumber'
      gender: usersTable.gender,
      height: usersTable.height,
      weight: usersTable.weight,
      createdAt: usersTable.created_at,
      // --- Wearable integration fields ---
      fit_tokens: usersTable.fit_tokens,
      last_sync: usersTable.last_sync,
      deviceName: usersTable.device_name, // Map DB 'device_name' to JS 'deviceName'
      googleOAuthId: usersTable.google_oauth_id // Map DB 'google_oauth_id' to JS 'googleOAuthId'
    })
    .from(usersTable)
    .where(eq(usersTable.id, userIdToFind)); // Using usersTable.id for WHERE clause
  
  if (results.length === 0) {
    return res.status(404).json({ error: `User with id ${id} not found` });
  }

  const user = results[0]; // This `user` object will now have the aliased properties (userID, firstName, etc.)
  
  // The userResponse object can now directly use these aliased properties.
  // Remove sensitive data like password if it was included in the select (it wasn't, which is good).
  
  res.json({
    message: `Successfully fetched user ${user.userID}`, // Use the JS property name
    data: user // The 'user' object already has the desired shape due to explicit aliasing in select
  });
}));

// Update user profile information
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userIdToFind = parseInt(id);

  if (isNaN(userIdToFind) || userIdToFind <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // Check if user exists
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userIdToFind));

  if (existingUser.length === 0) {
    return res.status(404).json({ error: `User with id ${id} not found` });
  }

  const { firstName, lastName, phoneNr, gender, height, weight, deviceName } = req.body;
  const updateData = {};

  // Validate and prepare update data
  if (firstName !== undefined) {
    if (typeof firstName !== 'string' || firstName.trim().length === 0) {
      return res.status(400).json({ error: 'First name must be a non-empty string' });
    }
    updateData.first_name = firstName.trim();
  }

  if (lastName !== undefined) {
    if (typeof lastName !== 'string' || lastName.trim().length === 0) {
      return res.status(400).json({ error: 'Last name must be a non-empty string' });
    }
    updateData.last_name = lastName.trim();
  }

  if (phoneNr !== undefined) {
    const phoneNumber = parseInt(phoneNr);
    if (isNaN(phoneNumber) || phoneNumber <= 0) {
      return res.status(400).json({ error: 'Phone number must be a valid positive number' });
    }
    updateData.phoneNr = phoneNumber;
  }

  if (gender !== undefined) {
    const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
    if (!validGenders.includes(gender.toLowerCase())) {
      return res.status(400).json({ error: 'Gender must be one of: male, female, other, prefer_not_to_say' });
    }
    updateData.gender = gender.toLowerCase();
  }

  if (height !== undefined) {
    const heightValue = parseFloat(height);
    if (isNaN(heightValue) || heightValue <= 0 || heightValue > 300) {
      return res.status(400).json({ error: 'Height must be a positive number between 1 and 300 cm' });
    }
    updateData.height = heightValue;
  }

  if (weight !== undefined) {
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 1000) {
      return res.status(400).json({ error: 'Weight must be a positive number between 1 and 1000 kg' });
    }
    updateData.weight = weightValue;
  }

  if (deviceName !== undefined) {
    if (typeof deviceName !== 'string') {
      return res.status(400).json({ error: 'Device name must be a string' });
    }
    updateData.device_name = deviceName.trim();
  }

  // Only update if there's data to update
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }

  await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, userIdToFind));
  
  // Return updated user data
  const updatedUser = await db
    .select({
      userID: usersTable.id,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      email: usersTable.email,
      phoneNr: usersTable.phoneNr,
      gender: usersTable.gender,
      height: usersTable.height,
      weight: usersTable.weight,
      deviceName: usersTable.device_name,
      createdAt: usersTable.created_at
    })
    .from(usersTable)
    .where(eq(usersTable.id, userIdToFind));
  
  res.json({
    message: `Successfully updated user profile`,
    data: updatedUser[0]
  });
}));

// Delete user by ID (Publicly accessible, VERY RISKY - needs admin protection)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userIdToDelete = parseInt(id);

  if (isNaN(userIdToDelete) || userIdToDelete <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // If you want to prevent deleting yourself via this public route,
  // you'd need a way to get the currently acting user's ID, which isn't possible without auth.
  // This route should ABSOLUTELY be protected by adminMiddleware.
  // For now, it's public and allows anyone to delete any user.

  await db
    .delete(usersTable)
    .where(eq(usersTable.id, userIdToDelete)); // Use correct schema property 'id'
  
  res.json({
    message: `Successfully deleted user ${id}`
  });
}));

// Deactivate/Activate user (Publicly accessible, VERY RISKY - needs admin protection)
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userIdToUpdate = parseInt(id);

  if (isNaN(userIdToUpdate) || userIdToUpdate <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const { isActive } = req.body;
  if (typeof isActive === 'undefined') {
      return res.status(400).json({ error: 'isActive status is required' });
  }

  // This route also needs admin protection.
  await db
    .update(usersTable)
    .set({ isActive })
    .where(eq(usersTable.id, userIdToUpdate)); // Use correct schema property 'id'

  res.json({
    message: `Successfully ${isActive ? 'activated' : 'deactivated'} user ${id}`
  });
}));

module.exports = router;