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

  const quickNav = {
    h: '/linear-mono/index.html',
    f: '/linear-mono/features.html',
    p: '/linear-mono/pricing.html',
    d: '/linear-mono/docs.html',
  };

  window.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const destination = quickNav[event.key.toLowerCase()];
    if (destination) {
      window.location.href = destination;
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
