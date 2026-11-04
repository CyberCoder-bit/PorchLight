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

  // 4. Accessibility menu (a native <details>, so it already opens and closes
  //    with Enter, Space, or a click). Here we add: Escape closes it and puts
  //    focus back on "Accessibility"; a click outside closes it; and after a
  //    choice made with the keyboard, focus comes back to the menu button on
  //    the reloaded page instead of starting over at the top.
  const menu = document.querySelector('.a11y-menu');
  if (!menu) return;
  const toggle = menu.querySelector('summary');
  const FOCUS_KEY = 'porchlight-a11y-focus';

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  // Tabbing out of the open menu closes it, so focus never lands on a link
  // hidden underneath the panel.
  menu.addEventListener('focusout', (event) => {
    if (menu.open && event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
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
