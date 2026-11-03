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
});
