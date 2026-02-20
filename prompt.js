 /* ── 공통 유틸 ──────────────────────────── */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildHighlightedHtml(raw) {
  return escHtml(raw)
    .replace(/\{([^}\n]+)\}/g,
      '<span class="var-token" title="클릭해서 내용을 바꾸세요">{$1}</span>')
    .replace(/\[([^\]\n]*[\uAC00-\uD7A3][^\]\n]*)\]/g,
      '<span class="var-token" title="클릭해서 내용을 바꾸세요">[$1]</span>');
}

/* ── textarea → contenteditable div 변환 ── */
function initEditablePrompts() {
  document.querySelectorAll('.prompt-textarea').forEach(ta => {
    const div = document.createElement('div');
    div.className = 'prompt-editable';
    div.contentEditable = 'true';
    div.setAttribute('spellcheck', 'false');
    div.setAttribute('autocorrect', 'off');
    div.setAttribute('autocapitalize', 'off');
    div.dataset.original = ta.value;
    div.innerHTML = buildHighlightedHtml(ta.value);

    /* {변수} 클릭 시 전체 선택 */
    div.addEventListener('click', e => {
      if (e.target.classList.contains('var-token')) {
        const range = document.createRange();
        range.selectNodeContents(e.target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    ta.parentNode.replaceChild(div, ta);
  });
}

/* ── 카드 내부 탭 전환 (템플릿 / 예시) ─── */
function innerTab(btn, showId, hideId) {
  const card = btn.closest('.prompt-card');
  card.querySelectorAll('.inner-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  card.querySelector('#' + showId).classList.add('active');
  card.querySelector('#' + hideId).classList.remove('active');
}

/* ── 분할 화면으로 변환 ─────────────────── */
function setupDivider(divider, leftPane, splitPane) {
  let dragging = false, startX = 0, startW = 0;

  const onStart = x => {
    dragging = true;
    startX = x;
    startW = leftPane.getBoundingClientRect().width;
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const onMove = x => {
    if (!dragging) return;
    const total = splitPane.getBoundingClientRect().width;
    const newW = Math.min(Math.max(startW + x - startX, 120), total - divider.offsetWidth - 120);
    leftPane.style.flex = `0 0 ${newW}px`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  divider.addEventListener('mousedown', e => { e.preventDefault(); onStart(e.clientX); });
  document.addEventListener('mousemove', e => onMove(e.clientX));
  document.addEventListener('mouseup', onEnd);
  divider.addEventListener('touchstart', e => { e.preventDefault(); onStart(e.touches[0].clientX); }, { passive: false });
  document.addEventListener('touchmove', e => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX); } }, { passive: false });
  document.addEventListener('touchend', onEnd);
}

function initSplitPanes() {
  document.querySelectorAll('.prompt-card').forEach(card => {
    const innerTabs = card.querySelector('.inner-tabs');
    if (!innerTabs) return;
    const panels = Array.from(card.querySelectorAll(':scope > .inner-panel'));
    if (panels.length !== 2) return;

    const [tmpl, ex] = panels;
    tmpl.remove();
    ex.remove();

    /* 분할 컨테이너 */
    const splitPane = document.createElement('div');
    splitPane.className = 'split-pane';

    const left = document.createElement('div');
    left.className = 'split-left';
    tmpl.style.display = 'block';
    left.appendChild(tmpl);

    const divider = document.createElement('div');
    divider.className = 'split-divider';
    divider.innerHTML = '<div class="split-handle"></div>';

    const right = document.createElement('div');
    right.className = 'split-right';
    ex.style.display = 'block';
    right.appendChild(ex);

    splitPane.append(left, divider, right);
    card.appendChild(splitPane);

    /* 헤더 탭 버튼 → 라벨 바 */
    const labelBar = document.createElement('div');
    labelBar.className = 'split-header-labels';
    labelBar.innerHTML = '<span class="split-label-tmpl">📋 템플릿 수정</span>'
                       + '<span class="split-label-arrow">↔</span>'
                       + '<span class="split-label-ex">✨ 예시 참고</span>';
    innerTabs.replaceWith(labelBar);

    setupDivider(divider, left, splitPane);

    /* 리셋 버튼 — 복사 버튼 앞에 삽입 */
    const copyBtn = card.querySelector('.prompt-card-header .copy-btn');
    if (copyBtn) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'reset-btn';
      resetBtn.textContent = '↺ 초기화';
      resetBtn.addEventListener('click', () => resetPrompt(resetBtn));
      copyBtn.parentNode.insertBefore(resetBtn, copyBtn);
    }
  });
}

/* ── 원본 초기화 ────────────────────────── */
function resetPrompt(btn) {
  const card = btn.closest('.prompt-card');
  const splitLeft = card.querySelector('.split-left');
  const target = splitLeft || card;
  const editable = target.querySelector('.prompt-editable');
  if (!editable || !editable.dataset.original) return;
  editable.innerHTML = buildHighlightedHtml(editable.dataset.original);
  btn.textContent = '✓ 초기화됨';
  setTimeout(() => { btn.textContent = '↺ 초기화'; }, 1500);
}

/* ── 프롬프트 복사 (분할 화면: 왼쪽 템플릿 우선) ── */
function copyPrompt(btn) {
  const card = btn.closest('.prompt-card');
  let text = '';

  /* 분할 화면: 왼쪽(템플릿) 패널에서 복사 */
  const splitLeft = card.querySelector('.split-left');
  if (splitLeft) {
    const editable = splitLeft.querySelector('.prompt-editable');
    const ta       = splitLeft.querySelector('textarea');
    if (editable) text = editable.innerText;
    else if (ta)  text = ta.value;
  } else {
    /* 기존 탭 방식 */
    const activePanel = card.querySelector('.inner-panel.active');
    if (activePanel) {
      const editable = activePanel.querySelector('.prompt-editable');
      const ta       = activePanel.querySelector('textarea');
      const display  = activePanel.querySelector('.prompt-display');
      if (editable)     text = editable.innerText;
      else if (ta)      text = ta.value;
      else if (display) text = display.innerText;
    } else {
      const editable = card.querySelector('.prompt-editable');
      const ta       = card.querySelector('textarea');
      if (editable) text = editable.innerText;
      else if (ta)  text = ta.value;
    }
  }

  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ 복사됨';
    btn.classList.add('copied');
    showToast();
    setTimeout(() => {
      btn.textContent = '복사';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

/* ── 워크플로우 배너 (챕터 페이지 고정) ── */
function initWfBanner() {
  const raw = sessionStorage.getItem('wf-data');
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch(e) { return; }

  const currentFile = location.pathname.split('/').pop() || 'index.html';

  const stepsHtml = data.steps.map((s, i) => {
    const isCurrent = (s.chapter + '.html') === currentFile;
    const arrow = i < data.steps.length - 1
      ? '<span class="wfb-arrow">→</span>' : '';
    return `<a class="wfb-step${isCurrent ? ' wfb-active' : ''}" href="${s.chapter}.html">
      <span class="wfb-num">${s.step}</span>
      <span class="wfb-title">${s.title}</span>
    </a>${arrow}`;
  }).join('');

  const banner = document.createElement('div');
  banner.className = 'wfb';
  banner.innerHTML = `
    <span class="wfb-label">워크플로우</span>
    <div class="wfb-steps">${stepsHtml}</div>
    <button class="wfb-close" title="워크플로우 종료"
      onclick="sessionStorage.removeItem('wf-data'); this.closest('.wfb').remove();">✕</button>`;
  document.body.appendChild(banner);
}

/* ── 모바일 사이드바 햄버거 버튼 ─────────── */
(function injectMobileNav() {
  const btn = document.createElement('button');
  btn.className = 'menu-toggle';
  btn.setAttribute('aria-label', '메뉴');
  btn.innerHTML = '☰';

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';

  document.body.prepend(overlay);
  document.body.prepend(btn);

  const sidebar = document.querySelector('.header');
  btn.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('sidebar-open');
    overlay.classList.toggle('active', isOpen);
    btn.innerHTML = isOpen ? '✕' : '☰';
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('sidebar-open');
    overlay.classList.remove('active');
    btn.innerHTML = '☰';
  });
  sidebar.querySelectorAll('.tab-btn').forEach(a => {
    a.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-open');
      overlay.classList.remove('active');
      btn.innerHTML = '☰';
    });
  });
})();

/* ── 페이지 로드 시 초기화 ─────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSplitPanes();
  initEditablePrompts();
  initWfBanner();
});
