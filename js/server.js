const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Import bcrypt
const path = require('path'); // Add path module
const session = require('express-session'); // Add session management

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10; // Number of salt rounds (higher is more secure but slower) 

app.use(cors());
app.use(bodyParser.json());

// Add session middleware
app.use(session({
  secret: 'weather-app-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..'))); 

// MongoDB Connection (as before)
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/weather-app')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error: ', err));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login.html');
};

// Login page route
app.get('/login.html', (req, res) => {
  if (req.session && req.session.userId) {
    // Already logged in, redirect to home
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Signup page route
app.get('/signup.html', (req, res) => {
  if (req.session && req.session.userId) {
    // Already logged in, redirect to home
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'signup.html'));
});

// Root route handler - protect the homepage with authentication
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// User Schema (as before)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Store the HASHED password
});

const User = mongoose.model('User', UserSchema);

// Signup Route (Modified to hash password)
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUserByUsername = await User.findOne({ username });
    const existingUserByEmail = await User.findOne({ email });

    if (existingUserByUsername || existingUserByEmail) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = new User({ username, email, password: hashedPassword }); // Store the HASH
    await newUser.save();
    
    // Set session after successful signup
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    
    res.status(201).json({ message: 'Signup successful', redirect: '/' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Signup failed' });
  }
});

// Login Route (Modified for password verification)
app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;

  if (!loginEmail || !loginPassword) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ $or: [{ email: loginEmail }, { username: loginEmail }] });
      
    if (user) {
      // Compare the entered password with the stored hash
      const passwordMatch = await bcrypt.compare(loginPassword, user.password);

      if (passwordMatch) {
        // Set session data
        req.session.userId = user._id;
        req.session.username = user.username;
        
        // Return successful login with redirect info
        res.status(200).json({ message: 'Login successful', redirect: '/' });
      } else {
        // Passwords do not match
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      // User not found
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.redirect('/login.html');
  });
});

// API route to check authentication status
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ 
      authenticated: true,
      username: req.session.username
    });
  }
  res.json({ authenticated: false });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Server running at http://localhost:${PORT}`);
});
