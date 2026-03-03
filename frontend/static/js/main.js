/* ═══════════════════════════════════════════════════════
   CV_One  –  main.js  (dark industrial UI)
   ═══════════════════════════════════════════════════════ */

const form            = document.getElementById('cvForm');
const operationSelect = document.getElementById('operation');
const runBtn          = document.getElementById('runBtn');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const jsonOut         = document.getElementById('jsonOut');
const jsonPanel       = document.getElementById('jsonPanel');
const jsonToggle      = document.getElementById('jsonToggle');

// Always fetch live from DOM so the reference stays valid
function getGrid() { return document.getElementById('imagesGrid'); }

/* ── Operation visibility ────────────────────────────── */
function showByOperation() {
  const op = operationSelect.value;
  document.querySelectorAll('.op-group').forEach(group => {
    const ops = (group.dataset.op || '').split(' ').filter(Boolean);
    group.style.display = ops.includes(op) ? 'block' : 'none';
  });
  document.querySelectorAll('.op-row').forEach(row => {
    const ops = (row.dataset.op || '').split(' ').filter(Boolean);
    row.style.display = ops.includes(op) ? 'block' : 'none';
  });
}

/* ── Status helpers ──────────────────────────────────── */
function setStatus(state, msg) {
  statusDot.className  = 'status-indicator ' + state;
  statusText.className = 'status-text ' + state;
  statusText.textContent = msg;
}

/* ── JSON panel toggle ───────────────────────────────── */
jsonToggle.addEventListener('click', () => {
  if (jsonOut.style.display === 'none') {
    jsonOut.style.display = '';
    jsonToggle.textContent = 'HIDE';
  } else {
    jsonOut.style.display = 'none';
    jsonToggle.textContent = 'SHOW';
  }
});

/* ── Badge factory ───────────────────────────────────── */
function makeBadge(label, cls) {
  const b = document.createElement('span');
  b.className = 'img-card-badge ' + cls;
  b.textContent = label;
  return b;
}

/* ── Card factory ────────────────────────────────────── */
function appendCard(container, title, src, badgeLabel, badgeCls, isWide, isGraph) {
  const card = document.createElement('div');
  card.className = 'img-card' + (isWide ? ' wide' : '') + (isGraph ? ' graph' : '');
  card.style.animationDelay = (container.querySelectorAll('.img-card').length * 0.04) + 's';

  const header = document.createElement('div');
  header.className = 'img-card-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'img-card-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  if (badgeLabel) header.appendChild(makeBadge(badgeLabel, badgeCls));

  const body = document.createElement('div');
  body.className = 'img-card-body';
  const img = document.createElement('img');
  img.src = src + '?t=' + Date.now();
  img.alt = title;
  img.loading = 'lazy';
  body.appendChild(img);

  card.appendChild(header);
  card.appendChild(body);
  container.appendChild(card);
}

/* ── Section heading ─────────────────────────────────── */
function appendSectionHeading(container, text) {
  const h = document.createElement('div');
  h.className = 'result-section-heading';
  h.textContent = text;
  container.appendChild(h);
}

/* ── Histogram + CDF side-by-side full-width row ─────── */
function appendHistCdfRow(container, histSrc, cdfSrc, label) {
  const wrap = document.createElement('div');
  wrap.className = 'hist-cdf-row';

  if (label) {
    const lbl = document.createElement('div');
    lbl.className = 'compare-row-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);
  }

  const cols = document.createElement('div');
  cols.className = 'hist-cdf-cols';

  function makePanel(src, title, badgeCls) {
    const card = document.createElement('div');
    card.className = 'img-card hist-cdf-card';

    const hdr = document.createElement('div');
    hdr.className = 'img-card-header';
    const t = document.createElement('span');
    t.className = 'img-card-title';
    t.textContent = title;
    hdr.appendChild(t);
    hdr.appendChild(makeBadge('GRAPH', badgeCls));

    const bdy = document.createElement('div');
    bdy.className = 'img-card-body hist-cdf-body';
    const im = document.createElement('img');
    im.src = src + '?t=' + Date.now();
    im.alt = title;
    im.loading = 'lazy';
    bdy.appendChild(im);

    card.appendChild(hdr);
    card.appendChild(bdy);
    return card;
  }

  cols.appendChild(makePanel(histSrc, 'Histogram', 'badge-graph'));
  cols.appendChild(makePanel(cdfSrc,  'CDF — Cumulative Distribution Function', 'badge-graph'));

  wrap.appendChild(cols);
  container.appendChild(wrap);
}

/* ── Side-by-side Before / After compare row ─────────── */
function appendCompareRow(container, label, beforeSrc, afterSrc) {
  const row = document.createElement('div');
  row.className = 'compare-row';

  const rowLabel = document.createElement('div');
  rowLabel.className = 'compare-row-label';
  rowLabel.textContent = label;
  row.appendChild(rowLabel);

  const cols = document.createElement('div');
  cols.className = 'compare-cols';

  function makeCompareCard(src, badgeLabel, badgeCls, cardTitle) {
    const card = document.createElement('div');
    card.className = 'img-card compare-card';

    const hdr = document.createElement('div');
    hdr.className = 'img-card-header';
    const t = document.createElement('span');
    t.className = 'img-card-title';
    t.textContent = cardTitle;
    hdr.appendChild(t);
    hdr.appendChild(makeBadge(badgeLabel, badgeCls));

    const bdy = document.createElement('div');
    bdy.className = 'img-card-body';
    const im = document.createElement('img');
    im.src = src + '?t=' + Date.now();
    im.alt = cardTitle + ' — ' + label;
    im.loading = 'lazy';
    bdy.appendChild(im);

    card.appendChild(hdr);
    card.appendChild(bdy);
    return card;
  }

  cols.appendChild(makeCompareCard(beforeSrc, 'BEFORE', 'badge-before', 'Before'));
  cols.appendChild(makeCompareCard(afterSrc,  'AFTER',  'badge-after',  'After'));

  row.appendChild(cols);
  container.appendChild(row);
}

/* ── Render results ──────────────────────────────────── */
function renderResult(response) {
  const grid = getGrid();
  grid.innerHTML = '';   // clear old results in-place (no DOM swap)

  jsonPanel.style.display = '';
  jsonOut.textContent = JSON.stringify(response, null, 2);

  const result = response.result || {};
  const op     = response.operation || '';

  /* Input image always first */
  if (response.input_image_url) {
    appendCard(grid, 'Input Image', response.input_image_url, 'INPUT', 'badge-input', false, false);
  }

  /* ── Standard single-output operations ── */
  if (result['output']) appendCard(grid, 'Output',     result['output'], 'OUTPUT', 'badge-output', false, false);
  if (result['edge'])   appendCard(grid, 'Edges',      result['edge'],   'OUTPUT', 'badge-output', false, false);
  if (result['x'])      appendCard(grid, 'Gradient X', result['x'],      'OUTPUT', 'badge-output', false, false);
  if (result['y'])      appendCard(grid, 'Gradient Y', result['y'],      'OUTPUT', 'badge-output', false, false);

  if (result['second_input'])
    appendCard(grid, 'Second Input', result['second_input'], 'INPUT', 'badge-input', false, false);

  /* Histogram + CDF — side-by-side full-width */
  if (result['histogram'] && result['cdf']) {
    appendHistCdfRow(grid, result['histogram'], result['cdf'], null);
  } else {
    if (result['histogram']) appendCard(grid, 'Histogram', result['histogram'], 'GRAPH', 'badge-graph', true, true);
    if (result['cdf'])       appendCard(grid, 'CDF',       result['cdf'],       'GRAPH', 'badge-graph', true, true);
  }

  /* ── Equalization: side-by-side before/after per channel ── */
  if (op === 'equalize') {
    if (result['output_gray'])
      appendCard(grid, 'Equalized – Grayscale', result['output_gray'], 'OUTPUT', 'badge-output', false, false);
    if (result['output_color_eq'])
      appendCard(grid, 'Equalized – Color (per-channel)', result['output_color_eq'], 'OUTPUT', 'badge-output', false, false);

    if (result['before_gray'] && result['after_gray']) {
      appendSectionHeading(grid, 'GRAYSCALE CHANNEL — Before vs After');
      appendHistCdfRow(grid, result['before_gray'], result['after_gray'], null);
    }
    if (result['before_b'] && result['after_b']) {
      appendSectionHeading(grid, 'BLUE CHANNEL — Before vs After');
      appendHistCdfRow(grid, result['before_b'], result['after_b'], null);
    }
    if (result['before_g'] && result['after_g']) {
      appendSectionHeading(grid, 'GREEN CHANNEL — Before vs After');
      appendHistCdfRow(grid, result['before_g'], result['after_g'], null);
    }
    if (result['before_r'] && result['after_r']) {
      appendSectionHeading(grid, 'RED CHANNEL — Before vs After');
      appendHistCdfRow(grid, result['before_r'], result['after_r'], null);
    }
  }

  /* ── Transformation outputs ── */
  if (op === 'transformation') {
    if (result['output_gray'])
      appendCard(grid, 'Grayscale Output', result['output_gray'], 'OUTPUT', 'badge-output', false, false);
    appendSectionHeading(grid, 'Channel Histograms + CDFs');
    if (result['hist_gray']) {
      const gWrap = document.createElement('div'); gWrap.className = 'hist-single-row';
      const gCard = document.createElement('div'); gCard.className = 'img-card hist-full-card';
      const gHdr = document.createElement('div'); gHdr.className = 'img-card-header';
      const gT = document.createElement('span'); gT.className = 'img-card-title'; gT.textContent = 'Gray · Histogram | CDF';
      gHdr.appendChild(gT); gHdr.appendChild(makeBadge('GRAPH','badge-graph'));
      const gBdy = document.createElement('div'); gBdy.className = 'img-card-body hist-cdf-body';
      const gIm = document.createElement('img'); gIm.src = result['hist_gray'] + '?t=' + Date.now(); gIm.alt = 'Gray hist+cdf'; gIm.loading = 'lazy';
      gBdy.appendChild(gIm); gCard.appendChild(gHdr); gCard.appendChild(gBdy); gWrap.appendChild(gCard); grid.appendChild(gWrap);
    }
    if (result['hist_r'] && result['hist_g']) {
      appendHistCdfRow(grid, result['hist_r'], result['hist_g'], 'Red vs Green — Histogram | CDF');
    }
    if (result['hist_b']) {
      const bWrap = document.createElement('div'); bWrap.className = 'hist-single-row';
      const bCard = document.createElement('div'); bCard.className = 'img-card hist-full-card';
      const bHdr = document.createElement('div'); bHdr.className = 'img-card-header';
      const bT = document.createElement('span'); bT.className = 'img-card-title'; bT.textContent = 'Blue · Histogram | CDF';
      bHdr.appendChild(bT); bHdr.appendChild(makeBadge('GRAPH','badge-graph'));
      const bBdy = document.createElement('div'); bBdy.className = 'img-card-body hist-cdf-body';
      const bIm = document.createElement('img'); bIm.src = result['hist_b'] + '?t=' + Date.now(); bIm.alt = 'Blue hist+cdf'; bIm.loading = 'lazy';
      bBdy.appendChild(bIm); bCard.appendChild(bHdr); bCard.appendChild(bBdy); bWrap.appendChild(bCard); grid.appendChild(bWrap);
    }
  }

  /* ── read_info: metadata table ── */
  if (op === 'read_info' && typeof result === 'object') {
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'grid-column:1/-1; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; animation:card-in 0.3s ease both';

    const hdr = document.createElement('div');
    hdr.className = 'img-card-header';
    hdr.innerHTML = '<span class="img-card-title">Image Metadata</span><span class="img-card-badge badge-output">INFO</span>';
    tableWrap.appendChild(hdr);

    const bdy = document.createElement('div');
    bdy.style.cssText = 'padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:10px;';
    Object.entries(result).filter(([k]) => k !== 'input_path').forEach(([key, val]) => {
      const item = document.createElement('div');
      item.style.cssText = 'background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:10px 14px;';
      item.innerHTML = `
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">${key}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:var(--amber)">${val}</div>
      `;
      bdy.appendChild(item);
    });
    tableWrap.appendChild(bdy);
    grid.appendChild(tableWrap);
  }
}

/* ── Form submit ─────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  runBtn.disabled = true;
  runBtn.classList.add('loading');
  setStatus('running', 'Processing…');

  // Hide empty state on first run
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';

  try {
    const body = new FormData(form);
    const res  = await fetch('/api/process/', { method: 'POST', body });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');

    renderResult(data);
    setStatus('done', 'Done — ' + (data.operation || '').replace(/_/g, ' '));
  } catch (err) {
    setStatus('error', 'Error: ' + err.message);
  } finally {
    runBtn.disabled = false;
    runBtn.classList.remove('loading');
  }
});

/* ── Init ────────────────────────────────────────────── */
operationSelect.addEventListener('change', showByOperation);
showByOperation();