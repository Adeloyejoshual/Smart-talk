const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://adeloyejoshua2020:MyRealPass123@smarttalk.3gxk7it.mongodb.net/smart-talk?retryWrites=true&w=majority&appName=Smarttalk';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch((err) => console.error('❌ MongoDB connection error:', err));