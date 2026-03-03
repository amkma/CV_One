/* ═══════════════════════════════════════════════════════
   CV_One  –  main.js  (dark industrial UI)
   ═══════════════════════════════════════════════════════ */

const form            = document.getElementById('cvForm');
const operationSelect = document.getElementById('operation');
const runBtn          = document.getElementById('runBtn');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const imagesGrid      = document.getElementById('imagesGrid');
const jsonOut         = document.getElementById('jsonOut');
const jsonPanel       = document.getElementById('jsonPanel');
const jsonToggle      = document.getElementById('jsonToggle');

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
  const pre = jsonOut;
  if (pre.style.display === 'none') {
    pre.style.display = '';
    jsonToggle.textContent = 'HIDE';
  } else {
    pre.style.display = 'none';
    jsonToggle.textContent = 'SHOW';
  }
});

/* ── Card factory ────────────────────────────────────── */
function makeBadge(label, cls) {
  const b = document.createElement('span');
  b.className = 'img-card-badge ' + cls;
  b.textContent = label;
  return b;
}

function appendCard(title, src, badgeLabel, badgeCls, isWide, isGraph) {
  const card = document.createElement('div');
  card.className = 'img-card' + (isWide ? ' wide' : '') + (isGraph ? ' graph' : '');
  card.style.animationDelay = (imagesGrid.querySelectorAll('.img-card').length * 0.04) + 's';

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
  imagesGrid.appendChild(card);
}

function appendSectionHeading(text) {
  const h = document.createElement('div');
  h.className = 'result-section-heading';
  h.textContent = text;
  imagesGrid.appendChild(h);
}

/* ── Render results ──────────────────────────────────── */
function renderResult(response) {
  imagesGrid.innerHTML = '';
  jsonPanel.style.display = '';

  jsonOut.textContent = JSON.stringify(response, null, 2);

  const result = response.result || {};
  const op     = response.operation || '';

  /* Input image always first */
  if (response.input_image_url) {
    appendCard('Input Image', response.input_image_url, 'INPUT', 'badge-input', false, false);
  }

  /* ── Standard single-output operations ── */
  if (result['output']) appendCard('Output', result['output'], 'OUTPUT', 'badge-output', false, false);
  if (result['edge'])   appendCard('Edges',  result['edge'],   'OUTPUT', 'badge-output', false, false);
  if (result['x'])      appendCard('Gradient X', result['x'], 'OUTPUT', 'badge-output', false, false);
  if (result['y'])      appendCard('Gradient Y', result['y'], 'OUTPUT', 'badge-output', false, false);

  if (result['second_input']) appendCard('Second Input', result['second_input'], 'INPUT', 'badge-input', false, false);

  /* Histogram + CDF (wide) */
  if (result['histogram']) appendCard('Histogram', result['histogram'], 'GRAPH', 'badge-graph', true, true);
  if (result['cdf'])       appendCard('CDF',       result['cdf'],       'GRAPH', 'badge-graph', true, true);

  /* ── Equalization outputs ── */
  if (op === 'equalize') {
    if (result['output_gray'])
      appendCard('Equalized – Grayscale', result['output_gray'], 'OUTPUT', 'badge-output', false, false);
    if (result['output_color_eq'])
      appendCard('Equalized – Color (per-channel)', result['output_color_eq'], 'OUTPUT', 'badge-output', false, false);

    appendSectionHeading('BEFORE Equalization');
    if (result['before_gray']) appendCard('Gray  · Histogram | CDF', result['before_gray'], 'BEFORE', 'badge-before', true, true);
    if (result['before_b'])    appendCard('Blue  · Histogram | CDF', result['before_b'],    'BEFORE', 'badge-before', true, true);
    if (result['before_g'])    appendCard('Green · Histogram | CDF', result['before_g'],    'BEFORE', 'badge-before', true, true);
    if (result['before_r'])    appendCard('Red   · Histogram | CDF', result['before_r'],    'BEFORE', 'badge-before', true, true);

    appendSectionHeading('AFTER Equalization');
    if (result['after_gray']) appendCard('Gray  · Histogram | CDF', result['after_gray'], 'AFTER', 'badge-after', true, true);
    if (result['after_b'])    appendCard('Blue  · Histogram | CDF', result['after_b'],    'AFTER', 'badge-after', true, true);
    if (result['after_g'])    appendCard('Green · Histogram | CDF', result['after_g'],    'AFTER', 'badge-after', true, true);
    if (result['after_r'])    appendCard('Red   · Histogram | CDF', result['after_r'],    'AFTER', 'badge-after', true, true);
  }

  /* ── Transformation outputs ── */
  if (op === 'transformation') {
    if (result['output_gray'])
      appendCard('Grayscale Output', result['output_gray'], 'OUTPUT', 'badge-output', false, false);

    appendSectionHeading('Channel Histograms + CDFs');
    if (result['hist_gray']) appendCard('Gray  · Histogram | CDF', result['hist_gray'], 'GRAPH', 'badge-graph', true, true);
    if (result['hist_r'])    appendCard('Red   · Histogram | CDF', result['hist_r'],    'GRAPH', 'badge-graph', true, true);
    if (result['hist_g'])    appendCard('Green · Histogram | CDF', result['hist_g'],    'GRAPH', 'badge-graph', true, true);
    if (result['hist_b'])    appendCard('Blue  · Histogram | CDF', result['hist_b'],    'GRAPH', 'badge-graph', true, true);
  }

  /* read_info: render as a nice table instead of raw JSON */
  if (op === 'read_info' && typeof result === 'object') {
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'grid-column:1/-1; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; animation:card-in 0.3s ease both';

    const hdr = document.createElement('div');
    hdr.className = 'img-card-header';
    hdr.innerHTML = '<span class="img-card-title">Image Metadata</span><span class="img-card-badge badge-output">INFO</span>';
    tableWrap.appendChild(hdr);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:10px;';

    Object.entries(result).filter(([k]) => k !== 'input_path').forEach(([key, val]) => {
      const item = document.createElement('div');
      item.style.cssText = 'background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:10px 14px;';
      item.innerHTML = `
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">${key}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:var(--amber)">${val}</div>
      `;
      body.appendChild(item);
    });

    tableWrap.appendChild(body);
    imagesGrid.appendChild(tableWrap);
  }
}

/* ── Form submit ─────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  runBtn.disabled = true;
  runBtn.classList.add('loading');
  setStatus('running', 'Processing…');
  imagesGrid.innerHTML = '';
  jsonPanel.style.display = 'none';

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