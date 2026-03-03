(() => {
  const rows = document.querySelectorAll('[data-testid="issue-row"]');
  const page = document.body.getAttribute('data-page');
  const links = document.querySelectorAll('.nav a');

  const activeMap = {
    home: '/linear-mono/index.html',
    features: '/linear-mono/features.html',
    pricing: '/linear-mono/pricing.html',
    docs: '/linear-mono/docs.html',
  };

  links.forEach((link) => {
    if (link.getAttribute('href') === activeMap[page]) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

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
