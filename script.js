(() => {
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => observer.observe(el));
  } else reveals.forEach((el) => el.classList.add('visible'));

  const buildCampaignMedia = ({
    section,
    image,
    alt,
    eyebrow,
    title,
    features,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref
  }) => {
    const media = document.querySelector(`${section} .editorial-media`);
    if (!media) return;

    media.classList.add('campaign-media');
    media.innerHTML = `
      <img src="${image}" alt="${alt}" />
      <div class="campaign-shade" aria-hidden="true"></div>
      <div class="campaign-content">
        <div class="campaign-brand">VELI <span>✦</span></div>
        <p class="campaign-eyebrow">${eyebrow}</p>
        <h3>${title}</h3>
        <div class="campaign-features">
          ${features.map((feature) => `<span>${feature}</span>`).join('')}
        </div>
        <div class="campaign-actions">
          <a class="campaign-button" href="${primaryHref}">${primaryLabel} <span aria-hidden="true">→</span></a>
          ${secondaryLabel ? `<a class="campaign-link" href="${secondaryHref}">${secondaryLabel}</a>` : ''}
        </div>
      </div>`;
  };

  buildCampaignMedia({
    section: '#safety',
    image: './assets/file_00000000e60081f4a62a09177e301330.png',
    alt: 'VELI supporting a safer evening journey with live location and safety awareness',
    eyebrow: 'TRAVEL SAFER. STAY CONNECTED.',
    title: 'Security that thinks ahead.',
    features: ['Live journey', 'Auto capture', 'Trusted alerts', 'Quick SOS'],
    primaryLabel: 'Meet VELI',
    primaryHref: '#waitlist',
    secondaryLabel: 'Explore the app',
    secondaryHref: '#app'
  });

  buildCampaignMedia({
    section: '#home-watch',
    image: './assets/file_000000004c74821082663689a417a42c.png',
    alt: 'VELI audio and video capture concept for intelligent home safety',
    eyebrow: 'YOUR QUIET GUARDIAN',
    title: 'Awake when something feels wrong.',
    features: ['Smart detection', 'Wake + record', 'Trusted alerts', 'Secure storage'],
    primaryLabel: 'Join the waitlist',
    primaryHref: '#waitlist',
    secondaryLabel: 'See safety features',
    secondaryHref: '#app'
  });

  const mainImage = document.getElementById('colorMainImage');
  document.querySelectorAll('.swatch').forEach((button) => {
    const src = button.dataset.image;
    if (src) {
      const preload = new Image();
      preload.src = src;
    }
    button.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      if (mainImage && button.dataset.image) {
        mainImage.style.opacity = '0';
        const nextSrc = button.dataset.image;
        const nextAlt = `${button.dataset.name} VELI paired with a ${button.dataset.bag} handbag`;
        const swap = new Image();
        swap.onload = () => {
          mainImage.src = nextSrc;
          mainImage.alt = nextAlt;
          requestAnimationFrame(() => { mainImage.style.opacity = '1'; });
        };
        swap.src = nextSrc;
      }
    });
  });

  const modal = document.getElementById('videoModal');
  document.getElementById('watchVideo')?.addEventListener('click', () => modal?.showModal());
  document.getElementById('closeVideo')?.addEventListener('click', () => modal?.close());
  modal?.addEventListener('click', (event) => {
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
  });

  const form = document.getElementById('waitlistForm');
  const status = document.getElementById('formStatus');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'form-status';
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const consent = data.get('consent') === 'on';
    if (!email || !consent) {
      status.textContent = 'Please enter your email and confirm launch updates.';
      status.classList.add('error');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = 'Joining…';
    try {
      const res = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, consent }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Could not join right now.');
      status.textContent = payload.already_joined ? 'You’re already on the VELI list ♡' : 'You’re on the VELI list ♡';
      status.classList.add('success');
      form.reset();
    } catch {
      status.textContent = 'The waitlist is being connected. Please try again shortly.';
      status.classList.add('error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
