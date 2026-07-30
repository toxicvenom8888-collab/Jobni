const fs = require('fs');
const path = require('path');

const phpDir = path.join(__dirname, '..', '..', 'zynexroot');
const viewsDir = path.join(__dirname, '..', 'views', 'admin');

const pageMap = [
  { php: 'login.php', ejs: 'login.ejs' },
  { php: 'index.php', ejs: 'dashboard.ejs' },
  { php: 'crew.php', ejs: 'crew.ejs' },
  { php: 'handlers.php', ejs: 'handlers.ejs' },
  { php: 'settings.php', ejs: 'settings.ejs' },
];

function stripLeadingPhp(content) {
  let result = content;
  while (true) {
    const trimmed = result.trimStart();
    if (!trimmed.startsWith('<?php') && !trimmed.startsWith('<?=')) {
      if (trimmed.startsWith('<!') || trimmed.startsWith('<') || trimmed.length === 0) {
        break;
      }
    }
    const match = trimmed.match(/^(<\?php[\s\S]*?\?>)/);
    if (match) {
      result = trimmed.slice(match[1].length);
    } else {
      break;
    }
  }
  return result;
}

function convertPhpToEjs(content) {
  let result = content;

  result = result.replace(/<\?php\s+echo\s+(.+?);\s*\?>/g, (match, expr) => {
    let ejs = expr.trim();
    ejs = ejs.replace(/htmlspecialchars\(/g, '');
    ejs = ejs.replace(/total_visits\(\$conn\)/g, 'totalVisits');
    ejs = ejs.replace(/total_victims\(\$conn\)/g, 'totalVictims');
    ejs = ejs.replace(/online_victims\(\$conn\)/g, 'onlineCount');
    ejs = ejs.replace(/online_handlers\(\$conn\)/g, '0');
    ejs = ejs.replace(/strtotime\(/g, '');
    ejs = ejs.replace(/\$_SESSION\[/g, 'session[');
    ejs = ejs.replace(/\]/g, ']');
    ejs = ejs.replace(/\$(\w+)/g, (m, name) => {
      if (['conn', 'this', 'that', 'server', 'array', 'row', 'query', 'result', 'stmt', 'redirects', 'btns', 'num', 'count'].includes(name) ||
          name.startsWith('_')) return m;
      return `locals.${name}`;
    });
    return `<%= ${ejs} %>`;
  });

  result = result.replace(/<\?php\s+if\s*\((.+?)\)\s*:\s*\?>/g, (match, cond) => {
    let c = cond;
    c = c.replace(/isset\(\$_SESSION\[(\w+)\]\)/g, "session['$1'] !== undefined");
    c = c.replace(/\$_SESSION\[(\w+)\]/g, "session['$1']");
    c = c.replace(/session_status\(\)\s*===\s*PHP_SESSION_NONE/g, 'true');
    c = c.replace(/session_start\(\)/g, '');
    c = c.replace(/\$(\w+)/g, (m, name) => `locals.${name}`);
    return `<% if (${c}) { %>`;
  });

  result = result.replace(/<\?php\s+else\s*:\s*\?>/g, '<% } else { %>');
  result = result.replace(/<\?php\s+endif;\s*\?>/g, '<% } %>');
  result = result.replace(/<\?php\s+endforeach;\s*\?>/g, '<% }) %>');
  result = result.replace(/<\?php\s+(foreach.+?):\s*\?>/g, (match, code) => {
    let c = code.replace(/\$(\w+)/g, (m, name) => `locals.${name}`);
    return `<% ${c} { %>`;
  });
  result = result.replace(/<\?php\s+(.+?);\s*\?>/g, (match, code) => {
    if (code.startsWith('error_reporting') || code.startsWith('ini_set') || code.startsWith('include') ||
        code.startsWith('header') || code.startsWith('session_') || code.startsWith('date_') ||
        code.startsWith('if') || code.startsWith('while') || code.startsWith('for') ||
        code.startsWith('foreach') || code.startsWith('switch') || code.startsWith('function') ||
        code.startsWith('mysqli_') || code.startsWith('die') || code.startsWith('exit') ||
        code.startsWith('$stmt') || code.startsWith('$query')) return '';
    let c = code.replace(/\$(\w+)/g, (m, name) => `locals.${name}`);
    return `<% ${c} %>`;
  });

  return result;
}

function addLocalsHeader(content) {
  return `<% const { user, home, homelive, getemail, name, session, config, totalVictims, totalVisits, onlineCount, handlers, error } = locals; %>\n${content}`;
}

for (const page of pageMap) {
  const phpPath = path.join(phpDir, page.php);
  const ejsPath = path.join(viewsDir, page.ejs);

  try {
    if (!fs.existsSync(phpPath)) {
      console.log(`Skipped (not found): ${page.php}`);
      continue;
    }
    let phpContent = fs.readFileSync(phpPath, 'utf8');
    let ejsContent = stripLeadingPhp(phpContent);
    ejsContent = convertPhpToEjs(ejsContent);
    ejsContent = addLocalsHeader(ejsContent);
    fs.writeFileSync(ejsPath, ejsContent, 'utf8');
    console.log(`Converted: ${page.php} -> ${page.ejs} (${phpContent.length} -> ${ejsContent.length} chars)`);
  } catch (err) {
    console.error(`Error converting ${page.php}:`, err.message);
  }
}
