// auth.js - Authentication and authorization service
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userModel = require('./models/userModel');

// User authentication
async function authenticateUser(username, password) {
  const user = await userModel.findOne({ username });
  if (!user) return null;
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;
  
  return generateToken(user);
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Access denied');
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).send('Invalid token');
  }
}

module.exports = { authenticateUser, generateToken, verifyToken };
