const navbar = document.querySelector('.navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = [...document.querySelectorAll('.nav-links a')];
const revealNodes = [...document.querySelectorAll('.reveal')];

function syncNavbarScroll() {
  if (!navbar) return;
  navbar.classList.toggle('scrolled', window.scrollY > 18);
}

function closeMenu() {
  if (!navMenu || !navToggle) return;
  navMenu.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  if (!navMenu || !navToggle) return;
  const next = !navMenu.classList.contains('open');
  navMenu.classList.toggle('open', next);
  navToggle.setAttribute('aria-expanded', String(next));
}

function setupAnchorLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      closeMenu();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setupReveal() {
  if (!('IntersectionObserver' in window) || revealNodes.length === 0) {
    revealNodes.forEach(node => node.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14 });

  revealNodes.forEach(node => observer.observe(node));
}

function setupActiveSections() {
  const sectionTargets = navLinks
    .map(link => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return null;
      return { link, section: document.querySelector(href) };
    })
    .filter(Boolean)
    .filter(item => item.section);

  if (!('IntersectionObserver' in window) || sectionTargets.length === 0) return;

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    sectionTargets.forEach(item => {
      item.link.classList.toggle('active', item.section === visible.target);
    });
  }, {
    rootMargin: '-35% 0px -50% 0px',
    threshold: [0.1, 0.3, 0.6]
  });

  sectionTargets.forEach(item => observer.observe(item.section));
}

function setupNavToggle() {
  if (!navToggle) return;
  navToggle.addEventListener('click', toggleMenu);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMenu();
  });
}

syncNavbarScroll();
setupNavToggle();
setupAnchorLinks();
setupReveal();
setupActiveSections();

window.addEventListener('scroll', syncNavbarScroll, { passive: true });
