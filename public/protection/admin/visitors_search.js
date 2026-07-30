// admin/visitors_search.js
// Plug-in search UI for the visitors table on the admin dashboard.
// Requires an element: <form id="visitorSearchForm"> and a <table class="visitor-table"> in the DOM.

(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return (root||document).querySelectorAll(sel); }

  function serializeForm(form) {
    const p = new URLSearchParams();
    new FormData(form).forEach((v,k) => {
      if (typeof v === 'string') {
        const vv = v.trim();
        if (vv !== '') p.append(k, vv);
      } else {
        p.append(k, v);
      }
    });
    return p;
  }

  function renderRows(rows) {
    const tbody = qs('.visitor-table tbody');
    if (!tbody) return;

    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const tr = document.createElement('tr');

      // IP
      const tdIp = document.createElement('td');
      tdIp.textContent = r.ip_address || '';
      tr.appendChild(tdIp);

      // Country
      const tdC = document.createElement('td');
      tdC.textContent = r.country || 'Unknown';
      tr.appendChild(tdC);

      // UA
      const tdUa = document.createElement('td');
      tdUa.style.maxWidth = '260px';
      tdUa.style.overflow = 'hidden';
      tdUa.style.textOverflow = 'ellipsis';
      tdUa.style.whiteSpace = 'nowrap';
      tdUa.title = r.user_agent || '';
      tdUa.textContent = (r.user_agent || '').slice(0, 60) + ((r.user_agent || '').length > 60 ? '…' : '');
      tr.appendChild(tdUa);

      // Status
      const tdStatus = document.createElement('td');
      const span = document.createElement('span');
      span.className = 'status-badge ' + (r.is_bot ? 'bot' : 'human');
      span.textContent = r.is_bot ? 'Bot' : 'Human';
      tdStatus.appendChild(span);
      tr.appendChild(tdStatus);

      // Behavioral Score
      const tdScore = document.createElement('td');
      tdScore.textContent = (r.behavioral_score ?? '') + '';
      tr.appendChild(tdScore);

      // Risk Score (placeholder if you compute elsewhere)
      const tdRisk = document.createElement('td');
      tdRisk.textContent = r.is_bot ? 'High' : 'Low';
      tr.appendChild(tdRisk);

      // Reason
      const tdReason = document.createElement('td');
      tdReason.textContent = r.block_reason || '';
      tr.appendChild(tdReason);

      // Created
      const tdCreated = document.createElement('td');
      tdCreated.textContent = r.created_at || '';
      tr.appendChild(tdCreated);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.innerHTML = `
        <button class="control-btn danger" data-action="block" data-id="${r.id}">Block</button>
        <button class="control-btn" data-action="unblock" data-id="${r.id}">Unblock</button>
        <button class="control-btn action" data-action="whitelist" data-id="${r.id}">Whitelist</button>
      `;
      tr.appendChild(tdActions);

      frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
  }

  async function doSearch(form, page) {
    const out = qs('#visitorSearchOutput');
    const btn = qs('#visitorSearchSubmit');
    if (btn) btn.disabled = true;

    try {
      const p = serializeForm(form);
      if (page) p.set('page', String(page));
      const url = 'search_visitors.php?' + p.toString();

      const res = await fetch(url, { credentials: 'same-origin' });
      const json = await res.json();

      if (!json.success) throw new Error(json.message || 'Search failed');
      renderRows(json.data || []);

      // Update counters if present
      const stats = qs('#searchStats');
      if (stats) {
        stats.textContent = `Results: ${json.total} | Page ${json.page}/${json.total_pages} | Bots on page: ${json.bots_on_page}`;
      }

      // Simple pager
      const pager = qs('#visitorSearchPager');
      if (pager) {
        pager.innerHTML = '';
        function pageBtn(pn, label){
          const b = document.createElement('button');
          b.className = 'control-btn';
          b.textContent = label;
          b.addEventListener('click', e => {
            e.preventDefault();
            doSearch(form, pn);
          });
          return b;
        }
        if (json.page > 1) pager.appendChild(pageBtn(json.page - 1, 'Prev'));
        if (json.page < json.total_pages) pager.appendChild(pageBtn(json.page + 1, 'Next'));
      }

    } catch (err) {
      console.error(err);
      const note = qs('#notification');
      if (note) {
        note.textContent = String(err.message || err);
        note.className = 'notification danger show';
        setTimeout(()=> note.classList.remove('show'), 2500);
      } else {
        alert('Search error: ' + err.message);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = document.querySelector('#visitorSearchForm');
    if (!form) return;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      doSearch(form, 1);
    });

    // Optional: auto-run if q has a value (e.g., when page loads)
    const q = form.querySelector('input[name="q"]');
    if (q && q.value.trim() !== '') doSearch(form, 1);
  });
})();
