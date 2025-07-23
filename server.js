// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const app = express();

mongoose.connect('your-mongodb-connection', { useNewUrlParser: true, useUnifiedTopology: true });

const User = mongoose.model('User', {
  username: String,
  password: String,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/register', async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  await User.create({ username: req.body.username, password: hashedPassword });
  res.redirect('/login.html');
});

app.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (user && await bcrypt.compare(req.body.password, user.password)) {
    res.redirect('/dashboard.html');
  } else {
    res.send('Invalid login');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
