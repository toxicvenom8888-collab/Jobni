if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./lib/config');
const { getRealIP } = require('./lib/telegram');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  req.realIP = getRealIP(req);
  res.locals.config = config;
  res.locals.session = req.session;
  next();
});

app.use(require('./routes/middleware'));
app.use('/', require('./routes/pages'));
app.use('/zynexroot/inc/action.php', require('./routes/api'));
app.use('/status.php', require('./routes/status'));
app.use('/zynexroot', require('./routes/admin'));
app.use('/zynexroot/inc/api.php', require('./routes/admin-poller'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

const port = config.port;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
