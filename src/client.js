(function () {
  function routeFromUrl(url) {
    let pathname = new URL(url, window.location.href).pathname;
    pathname = pathname.replace(/\/index\.html$/, '/');
    pathname = pathname.replace(/\/$/, '') || '/';
    return pathname;
  }

  function updateActiveNav(route) {
    const clean = route || '/';
    const section = clean === '/' ? '/' : '/' + clean.split('/').filter(Boolean).pop();
    const topSection = clean === '/' ? '/' : '/' + clean.split('/').filter(Boolean)[0];
    document.querySelectorAll('nav a[data-route]').forEach((anchor) => {
      anchor.classList.toggle('active', anchor.dataset.route === topSection || anchor.dataset.route === section);
    });
  }

  async function navigate(url, push) {
    const response = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
    if (!response.ok) {
      window.location.href = url;
      return;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextArticle = doc.querySelector('article');
    const currentArticle = document.querySelector('article');
    if (!nextArticle || !currentArticle) {
      window.location.href = url;
      return;
    }

    const commit = () => {
      document.title = doc.title;
      currentArticle.innerHTML = nextArticle.innerHTML;
      document.body.dataset.route = doc.body.dataset.route || routeFromUrl(url);
      updateActiveNav(document.body.dataset.route);
      if (push) history.pushState({}, '', url);
      window.scrollTo({ top: 0, left: 0 });
    };

    if (document.startViewTransition) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]:not([target]):not([download])');
    if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;

    event.preventDefault();
    navigate(url.href, true).catch(() => {
      window.location.href = url.href;
    });
  });

  window.addEventListener('popstate', () => {
    navigate(window.location.href, false).catch(() => window.location.reload());
  });

  updateActiveNav(document.body.dataset.route || routeFromUrl(window.location.href));
})();
