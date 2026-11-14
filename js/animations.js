
document.addEventListener('DOMContentLoaded', () => {
  // Check if GSAP is available
  if (typeof gsap === 'undefined') {
    console.warn('GSAP is not loaded');
    return;
  }

  // Register ScrollTrigger if available
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Respect user preference for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  /* ===================================================
     1. HERO SECTION - ENTRANCE ANIMATION (ON LOAD)
     =================================================== */
  // Jika loader sedang tampil, animasi masuk hero ditahan sampai tirai mulai terbuka (event "loader:done").
  const waitForLoader = document.documentElement.classList.contains('is-loading');
  const heroTL = gsap.timeline({
    defaults: { ease: 'power3.out' },
    delay: 0.15,
    paused: waitForLoader
  });

  if (waitForLoader) {
    document.addEventListener('loader:done', () => {
      heroTL.play();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    }, { once: true });
    // Pengaman: jika event tidak pernah datang, mulai juga
    setTimeout(() => heroTL.paused() && heroTL.play(), 13000);
  }

  // Background fade & scale
  heroTL.from('.hero-bg', {
    scale: 1.05,
    opacity: 0.8,
    duration: 1.8,
    ease: 'power2.out'
  }, 0);

  // Header navigation
  heroTL.from('.header', {
    y: -35,
    opacity: 0,
    duration: 0.9
  }, 0.2);

  // Hero headline
  heroTL.from('.hero-copy h1', {
    y: 50,
    opacity: 0,
    duration: 1.1,
    ease: 'power4.out'
  }, 0.35);

  // Hero subtitle paragraph
  heroTL.from('.hero-copy p', {
    y: 30,
    opacity: 0,
    duration: 0.85
  }, 0.55);

  // Hero CTA button wrapper
  heroTL.from('.hero-copy .btn-wrapper', {
    y: 25,
    opacity: 0,
    scale: 0.95,
    duration: 0.75,
    ease: 'back.out(1.6)'
  }, 0.7);

  // --- Hero Preview Cards & Decorations ---
  // 1. Identity preview card ("soft spot." yellow poster)
  heroTL.from('.identity-card', {
    y: 90,
    rotation: -18,
    scale: 0.88,
    opacity: 0,
    duration: 1.25,
    ease: 'back.out(1.4)'
  }, 0.5);

  // 2. Concept disclosure badge
  heroTL.from('.concept-badge', {
    scale: 0,
    opacity: 0,
    duration: 0.65,
    ease: 'back.out(2)'
  }, 0.8);

  // 3. Product preview card ("202X Resolutions" white card)
  heroTL.from('.product-card', {
    y: 100,
    rotation: 18,
    scale: 0.85,
    opacity: 0,
    duration: 1.25,
    ease: 'back.out(1.3)'
  }, 0.65);

  // 4. Star decoration (top right)
  heroTL.from('.star-decoration', {
    scale: 0,
    rotation: -60,
    opacity: 0,
    duration: 0.85,
    ease: 'elastic.out(1, 0.45)'
  }, 0.9);

  // 5. Pencil / Union raster decoration
  heroTL.from('.pencil-decoration', {
    y: -50,
    opacity: 0,
    scale: 0.9,
    duration: 0.9,
    ease: 'back.out(1.5)'
  }, 0.75);

  // 6. Scroll invitation
  heroTL.from('.scroll-invitation', {
    y: 20,
    opacity: 0,
    duration: 0.8
  }, 1.1);

  // Subtle continuous floating for hero preview cards
  heroTL.add(() => {
    gsap.to('.identity-card', {
      y: '+=7',
      rotation: '-=1.2',
      duration: 3.6,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    gsap.to('.product-card', {
      y: '-=8',
      rotation: '+=1.0',
      duration: 3.2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      delay: 0.4
    });

    gsap.to('.star-decoration', {
      scale: 1.08,
      rotation: '+=6',
      duration: 2.4,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    gsap.to('.pencil-decoration', {
      y: '+=5',
      duration: 3.0,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      delay: 0.2
    });
  });


  /* ===================================================
     2. SCROLL ANIMATIONS (SCROLLTRIGGER)
     =================================================== */
  if (typeof ScrollTrigger === 'undefined') {
    return;
  }

  /* ---------- A. ABOUT SECTION ---------- */
  const aboutTL = gsap.timeline({
    scrollTrigger: {
      trigger: '#about',
      start: 'top 78%',
      toggleActions: 'play none none none'
    },
    defaults: { ease: 'power3.out' }
  });

  // Left column elements
  aboutTL.from('.about__eyebrow', {
    y: 20,
    opacity: 0,
    duration: 0.6
  }, 0);

  aboutTL.from('.about__title', {
    y: 40,
    opacity: 0,
    duration: 0.9
  }, 0.1);

  // Browser tabs slide in with stagger
  aboutTL.from('.tabs__shape--green', {
    x: -30,
    opacity: 0,
    duration: 0.6
  }, 0.25);

  aboutTL.from('.tabs__shape--orange', {
    x: -30,
    opacity: 0,
    duration: 0.6
  }, 0.35);

  aboutTL.from('.tabs__shape--blue', {
    x: -30,
    opacity: 0,
    duration: 0.6
  }, 0.45);

  aboutTL.from('.tabs__label', {
    opacity: 0,
    y: 10,
    duration: 0.5,
    stagger: 0.1
  }, 0.5);

  aboutTL.from('.tabs__plus', {
    scale: 0,
    opacity: 0,
    duration: 0.4,
    ease: 'back.out(2)'
  }, 0.65);

  // Text paragraphs
  aboutTL.from('.about__text', {
    y: 25,
    opacity: 0,
    duration: 0.7,
    stagger: 0.18
  }, 0.45);

  // Right column visual elements
  aboutTL.from('.visual__dashed', {
    scale: 0.9,
    opacity: 0,
    duration: 0.8
  }, 0.2);

  aboutTL.from('.visual__gimmick', {
    y: 100,
    opacity: 0,
    duration: 1.1,
    ease: 'power3.out'
  }, 0.3);

  aboutTL.from('.visual__frame-label', {
    y: -15,
    opacity: 0,
    duration: 0.5
  }, 0.6);

  aboutTL.from('.poster', {
    y: -60,
    scale: 0.9,
    opacity: 0,
    duration: 0.95,
    ease: 'back.out(1.4)'
  }, 0.45);

  aboutTL.from('.selection', {
    scale: 0.75,
    y: -20,
    opacity: 0,
    duration: 0.65,
    ease: 'back.out(1.8)'
  }, 0.65);

  aboutTL.from('.visual__star', {
    scale: 0,
    rotation: 60,
    opacity: 0,
    duration: 0.75,
    ease: 'back.out(2)'
  }, 0.75);

  aboutTL.from('.cursor', {
    x: 40,
    y: 40,
    opacity: 0,
    duration: 0.85
  }, 0.85);


  /* ---------- B. SELECTED WORK SECTION ---------- */
  const workTL = gsap.timeline({
    scrollTrigger: {
      trigger: '#work',
      start: 'top 78%',
      toggleActions: 'play none none none'
    },
    defaults: { ease: 'power3.out' }
  });

  workTL.from('.work-heading .section-label', {
    y: 20,
    opacity: 0,
    duration: 0.6
  }, 0);

  workTL.from('.work-heading h2', {
    y: 40,
    opacity: 0,
    duration: 0.9
  }, 0.1);

  workTL.from('.work-desc', {
    y: 25,
    opacity: 0,
    duration: 0.8
  }, 0.2);

  // Garis pemisah tergambar dari kiri, lalu baris proyek naik bergantian.
  // clearProps: agar style inline tidak menimpa kelas .is-active / .is-hovering setelah animasi selesai.
  workTL.from('.work-index', {
    '--line': 0,
    duration: 0.9,
    clearProps: '--line'
  }, 0.3);

  workTL.from('.work-item', {
    y: 40,
    opacity: 0,
    '--line': 0,
    duration: 0.9,
    stagger: 0.12,
    clearProps: 'transform,opacity,--line'
  }, 0.4);

  workTL.from('.work-hint', {
    opacity: 0,
    duration: 0.6
  }, 0.9);


  /* ---------- C. CONTACT & FOOTER SECTION ---------- */
  const contactTL = gsap.timeline({
    scrollTrigger: {
      trigger: '#contact',
      start: 'top 80%',
      toggleActions: 'play none none none'
    },
    defaults: { ease: 'power3.out' }
  });

  contactTL.from('.invitation-copy .section-label', {
    y: 20,
    opacity: 0,
    duration: 0.6
  }, 0);

  contactTL.from('.invitation-copy h2', {
    y: 45,
    opacity: 0,
    duration: 1.0
  }, 0.1);

  contactTL.from('.contact-next p', {
    y: 25,
    opacity: 0,
    duration: 0.8
  }, 0.25);

  contactTL.from('.contact-next .btn-wrapper', {
    y: 25,
    scale: 0.92,
    opacity: 0,
    duration: 0.75,
    ease: 'back.out(1.6)'
  }, 0.4);

  contactTL.from('.footer', {
    opacity: 0,
    y: 25,
    duration: 0.8
  }, 0.55);
});

