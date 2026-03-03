(() => {
  const rows = document.querySelectorAll('[data-testid="issue-row"]');

  rows.forEach((row) => {
    row.addEventListener('click', () => {
      rows.forEach((r) => {
        r.style.borderColor = 'var(--line-soft)';
        r.setAttribute('aria-selected', 'false');
      });
      row.style.borderColor = 'var(--text-0)';
      row.setAttribute('aria-selected', 'true');
    });
  });
})();
