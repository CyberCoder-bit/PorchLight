// Small progressive enhancements. The site works fully without this file.

document.addEventListener('DOMContentLoaded', () => {
  // 1. Prevent double-submits and show progress ("Asking Claude…").
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const button = event.submitter || form.querySelector('button[type="submit"]');
      if (!button) return;
      // Let the browser read the clicked button's name/value before disabling it.
      setTimeout(() => {
        button.disabled = true;
        if (form.dataset.busyText) button.textContent = form.dataset.busyText;
      }, 0);
    });
  });

  // 2. If a form came back with errors, move focus to the error summary so
  //    screen reader users hear what to fix.
  const summary = document.getElementById('error-summary');
  if (summary) summary.focus();

  // 3. After generating sparks, move focus to the results.
  if (location.hash === '#sparks') {
    const sparks = document.getElementById('sparks');
    if (sparks) sparks.focus();
  }

  // 4. The header's two menus: Accessibility, and Menu (the nav on narrow
  //    screens). Both are native <details>, so they already open and close
  //    with Enter, Space, or a click (Accessibility, Language, and Menu). Here we add: only one is open at a time;
  //    Escape closes the open one and puts focus back on its button; a click
  //    outside closes it; and tabbing out closes it, so focus never lands on
  //    something hidden under a panel. Menu's page list is the <nav> right
  //    after its <details> (styles.css shows it while Menu is open; the
  //    summary's aria-controls names it), so that nav counts as part of Menu.
  const menus = [...document.querySelectorAll('.a11y-menu, .lang-menu, .site-menu')].map((details) => {
    const toggle = details.querySelector('summary');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') || '');
    return { details, toggle, parts: panel ? [details, panel] : [details] };
  });
  const isInside = (m, node) => node instanceof Node && m.parts.some((part) => part.contains(node));

  menus.forEach((m) => {
    m.details.addEventListener('toggle', () => {
      if (m.details.open) menus.forEach((other) => { if (other !== m) other.details.open = false; });
    });
    m.parts.forEach((part) => part.addEventListener('focusout', (event) => {
      if (m.details.open && event.relatedTarget && !isInside(m, event.relatedTarget)) m.details.open = false;
    }));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    menus.forEach((m) => {
      if (!m.details.open) return;
      m.details.open = false;
      m.toggle.focus();
    });
  });
  document.addEventListener('click', (event) => {
    menus.forEach((m) => { if (m.details.open && !isInside(m, event.target)) m.details.open = false; });
  });

  // After a choice made in Accessibility with the keyboard, focus comes back
  // to its button on the reloaded page instead of starting over at the top.
  const menu = document.querySelector('.a11y-menu');
  if (!menu) return;
  const toggle = menu.querySelector('summary');
  const FOCUS_KEY = 'porchlight-a11y-focus';
  menu.querySelectorAll('.pref-option').forEach((button) => {
    button.addEventListener('click', (event) => {
      // detail is 0 when Enter or Space pressed the button, 1+ for a mouse or tap.
      if (event.detail !== 0) return;
      try { sessionStorage.setItem(FOCUS_KEY, '1'); } catch { /* storage may be off */ }
    });
  });
  try {
    if (sessionStorage.getItem(FOCUS_KEY)) {
      sessionStorage.removeItem(FOCUS_KEY);
      toggle.focus();
    }
  } catch { /* storage may be off */ }
});
