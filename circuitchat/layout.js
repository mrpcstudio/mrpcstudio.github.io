const STORAGE_KEY = 'circuitchat-layout';
const DEFAULTS = { sidebar: 245, chat: 420, hidden: { sidebar: false, chat: false, circuit: false } };
const LIMITS = { sidebar: [180, 460], chat: [280, 760], circuit: 340 };

function readLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      sidebar: Number.isFinite(saved.sidebar) ? saved.sidebar : DEFAULTS.sidebar,
      chat: Number.isFinite(saved.chat) ? saved.chat : DEFAULTS.chat,
      hidden: Object.fromEntries(['sidebar', 'chat', 'circuit'].map(name => [name, saved.hidden?.[name] === true]))
    };
  } catch { return structuredClone(DEFAULTS); }
}

export function initLayout() {
  if (window.__circuitChatLayout) return window.__circuitChatLayout;
  const main = document.querySelector('main');
  const sidebar = main?.querySelector(':scope > aside.sidebar');
  const chat = main?.querySelector(':scope > section.chat-panel');
  const circuit = main?.querySelector(':scope > section.circuit-panel');
  if (!main || !sidebar || !chat || !circuit) return null;

  const state = readLayout();
  for (const name of ['sidebar', 'chat', 'circuit']) state.hidden[name] = state.hidden[name] === true;
  if (Object.values(state.hidden).every(Boolean)) state.hidden.circuit = false;
  const separators = [];
  const panels = { sidebar, chat, circuit };
  for (const [name, panel] of Object.entries(panels)) if (!panel.id) panel.id = `layout-${name}-panel`;

  function makeSeparator(name, before, after) {
    const separator = document.createElement('div');
    separator.className = 'layout-separator';
    separator.dataset.layoutSeparator = name;
    separator.setAttribute('role', 'separator');
    separator.setAttribute('aria-orientation', 'vertical');
    separator.tabIndex = 0;
    separator.setAttribute('aria-label', name === 'sidebar' ? '调整侧栏宽度' : '调整聊天面板宽度');
    main.insertBefore(separator, after);
    separators.push({ name, element: separator, before, after });
    return separator;
  }
  makeSeparator('sidebar', sidebar, chat);
  makeSeparator('chat', chat, circuit);

  const actions = document.querySelector('.header-actions');
  const controls = {};
  for (const name of ['sidebar', 'chat', 'circuit']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-toggle';
    button.dataset.layoutToggle = name;
    button.setAttribute('aria-controls', panels[name].id || `${name}-panel`);
    button.setAttribute('aria-expanded', 'true');
    button.textContent = name === 'sidebar' ? '侧栏' : name === 'chat' ? '聊天' : '电路';
    button.title = `折叠${button.textContent}面板`;
    actions?.append(button);
    controls[name] = button;
  }

  function mobile() { return matchMedia('(max-width: 1000px)').matches; }
  function clampWidths() {
    state.sidebar = Math.round(Math.max(LIMITS.sidebar[0], Math.min(LIMITS.sidebar[1], state.sidebar)));
    state.chat = Math.round(Math.max(LIMITS.chat[0], Math.min(LIMITS.chat[1], state.chat)));
    if (mobile()) return;
    const separatorWidth = (!state.hidden.sidebar && !state.hidden.chat ? 8 : 0) + (!state.hidden.chat && !state.hidden.circuit ? 8 : 0);
    const usable = Math.max(0, main.clientWidth - separatorWidth - (state.hidden.circuit ? 0 : LIMITS.circuit));
    if (!state.hidden.sidebar && !state.hidden.chat) {
      if (state.sidebar + state.chat > usable) {
        state.chat = Math.max(LIMITS.chat[0], usable - state.sidebar);
        state.sidebar = Math.max(LIMITS.sidebar[0], Math.min(state.sidebar, usable - state.chat));
      }
    } else if (!state.hidden.sidebar) state.sidebar = Math.max(LIMITS.sidebar[0], Math.min(state.sidebar, usable));
    else if (!state.hidden.chat) state.chat = Math.max(LIMITS.chat[0], Math.min(state.chat, usable));
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
  function visibleCount() { return Object.values(state.hidden).filter(value => !value).length; }
  function apply() {
    clampWidths();
    const isMobile = mobile();
    for (const name of Object.keys(panels)) {
      const hidden = !!state.hidden[name];
      panels[name].classList.toggle('layout-collapsed', hidden);
      panels[name].setAttribute('aria-hidden', String(hidden));
      controls[name].setAttribute('aria-expanded', String(!hidden));
      controls[name].textContent = hidden ? `显示${name === 'sidebar' ? '侧栏' : name === 'chat' ? '聊天' : '电路'}` : name === 'sidebar' ? '侧栏' : name === 'chat' ? '聊天' : '电路';
      controls[name].title = hidden ? `恢复${controls[name].textContent.slice(2)}面板` : `折叠${controls[name].textContent}面板`;
    }
    for (const item of separators) {
      const disabled = isMobile || state.hidden[item.name] || state.hidden[item.name === 'sidebar' ? 'chat' : 'circuit'];
      item.element.classList.toggle('is-disabled', disabled);
      item.element.setAttribute('aria-hidden', String(disabled));
      item.element.setAttribute('aria-controls', panels[item.name].id);
      item.element.setAttribute('aria-valuemin', String(LIMITS[item.name][0]));
      item.element.setAttribute('aria-valuemax', String(LIMITS[item.name][1]));
      item.element.setAttribute('aria-valuenow', String(state[item.name]));
      item.element.setAttribute('aria-valuetext', `${state[item.name]} 像素`);
      item.element.tabIndex = disabled ? -1 : 0;
    }
    if (isMobile) {
      main.style.removeProperty('grid-template-columns');
    } else {
      const tracks = [
        state.hidden.sidebar ? '0px' : state.hidden.chat&&state.hidden.circuit?'minmax(180px,1fr)':`${state.sidebar}px`,
        state.hidden.sidebar || state.hidden.chat ? '0px' : '8px',
        state.hidden.chat ? '0px' : state.hidden.circuit ? 'minmax(280px,1fr)' : `${state.chat}px`,
        state.hidden.chat || state.hidden.circuit ? '0px' : '8px',
        state.hidden.circuit ? '0px' : 'minmax(340px, 1fr)'
      ];
      main.style.gridTemplateColumns = tracks.join(' ');
    }
    save();
  }
  function toggle(name) {
    if (!state.hidden[name] && visibleCount() <= 1) return;
    state.hidden[name] = !state.hidden[name];
    apply();
  }
  for (const name of Object.keys(controls)) controls[name].addEventListener('click', () => toggle(name));

  let drag = null;
  function move(event) {
    if (!drag) return;
    const delta = event.clientX - drag.x;
    if (drag.name === 'sidebar') state.sidebar = drag.value + delta;
    else { state.chat = drag.value + delta; }
    apply();
  }
  function end(event) {
    if (!drag) return;
    try { drag.element.releasePointerCapture(event.pointerId); } catch {}
    drag = null;
    save();
  }
  for (const item of separators) {
    item.element.addEventListener('pointerdown', event => {
      if (item.element.classList.contains('is-disabled') || mobile() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag = { name: item.name, element: item.element, x: event.clientX, value: item.name === 'sidebar' ? state.sidebar : state.chat };
      item.element.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    item.element.addEventListener('pointermove', move);
    item.element.addEventListener('pointerup', end);
    item.element.addEventListener('pointercancel', end);
    item.element.addEventListener('keydown', event => {
      if (item.element.classList.contains('is-disabled')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const amount = event.key === 'ArrowLeft' ? -10 : 10;
        if (item.name === 'sidebar') state.sidebar += amount; else state.chat += amount;
        apply(); event.preventDefault();
      } else if (event.key === 'Home') {
        if (item.name === 'sidebar') state.sidebar = LIMITS.sidebar[0]; else state.chat = LIMITS.chat[0];
        apply(); event.preventDefault();
      } else if (event.key === 'End') {
        if (item.name === 'sidebar') state.sidebar = LIMITS.sidebar[1]; else state.chat = LIMITS.chat[1];
        apply(); event.preventDefault();
      }
    });
  }
  const resize = () => apply();
  addEventListener('resize', resize, { passive: true });
  apply();
  const api = { refresh: apply, togglePanel: toggle, destroy() { removeEventListener('resize', resize); for (const item of separators) item.element.remove(); for (const button of Object.values(controls)) button.remove(); delete window.__circuitChatLayout; } };
  window.__circuitChatLayout = api;
  return api;
}
