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

app.use(cors({
  origin: 'https://skycastlive.online',
  credentials: true
}));
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

// Authorization middleware
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

// Modify the authentication middleware to include role
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

// History page route
app.get('/history.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'history.html'));
});

// Admin page route
app.get('/admin.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// User Schema (as before)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Add role field
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Modify signup route to only allow admin to create admin users
app.post('/signup', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUserByUsername = await User.findOne({ username });
    const existingUserByEmail = await User.findOne({ email });

    if (existingUserByUsername || existingUserByEmail) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }

    // Only allow admin role if the request comes from an admin
    const userRole = (req.session && req.session.role === 'admin' && role === 'admin') ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = new User({ 
      username, 
      email, 
      password: hashedPassword,
      role: userRole 
    });
    
    await newUser.save();
    
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.role = newUser.role;
    
    res.status(201).json({ 
      message: 'Signup successful', 
      redirect: '/',
      role: newUser.role 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Signup failed' });
  }
});

// Modify login route to include role
app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;

  if (!loginEmail || !loginPassword) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ $or: [{ email: loginEmail }, { username: loginEmail }] });
      
    if (user) {
      const passwordMatch = await bcrypt.compare(loginPassword, user.password);

      if (passwordMatch) {
        // Set session data including role
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        res.status(200).json({ 
          message: 'Login successful', 
          redirect: '/',
          role: user.role 
        });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
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

// Modify auth status route to include role
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ 
      authenticated: true,
      username: req.session.username,
      role: req.session.role
    });
  }
  res.json({ authenticated: false });
});

// Weather History Schema
const WeatherHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: { type: String, required: true },
  searchDate: { type: Date, default: Date.now },
  isFavorite: { type: Boolean, default: false },
  weather: [
    {
      date: String,
      temp_c: Number,
      min_temp_c: Number,
      max_temp_c: Number,
      wind_kph: Number,
      condition_text: String,
      condition_icon: String
    }
  ]
});

const WeatherHistory = mongoose.model('WeatherHistory', WeatherHistorySchema);

// Save weather search history
app.post('/api/weather/history', isAuthenticated, async (req, res) => {
  try {
    const { location, weather } = req.body;
    const newHistory = new WeatherHistory({
      userId: req.session.userId,
      location: location,
      weather: weather
    });
    await newHistory.save();
    res.status(201).json({ message: 'Search history saved' });
  } catch (error) {
    console.error('Error saving weather history:', error);
    res.status(500).json({ message: 'Failed to save search history' });
  }
});

// Get user's weather history
app.get('/api/weather/history', isAuthenticated, async (req, res) => {
  try {
    const history = await WeatherHistory.find({ userId: req.session.userId })
      .sort({ searchDate: -1 })
      .limit(10);
    res.json(history);
  } catch (error) {
    console.error('Error fetching weather history:', error);
    res.status(500).json({ message: 'Failed to fetch search history' });
  }
});

// Toggle favorite status for a location
app.put('/api/weather/favorite/:id', isAuthenticated, async (req, res) => {
  try {
    const history = await WeatherHistory.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });
    
    if (!history) {
      return res.status(404).json({ message: 'Search history not found' });
    }
    
    history.isFavorite = !history.isFavorite;
    await history.save();
    res.json({ message: 'Favorite status updated', isFavorite: history.isFavorite });
  } catch (error) {
    console.error('Error updating favorite status:', error);
    res.status(500).json({ message: 'Failed to update favorite status' });
  }
});

// Add admin-only routes
app.get('/api/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude password field
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Server running at https://skycastlive.online`);
});
