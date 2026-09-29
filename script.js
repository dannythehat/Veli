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

  // Cloudflare Web Analytics. SPA mode lets the "/joined" virtual page view count waitlist signups.
  const analyticsToken = window.VELI_CF_ANALYTICS_TOKEN;
  if (analyticsToken) {
    const beacon = document.createElement('script');
    beacon.defer = true;
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.dataset.cfBeacon = JSON.stringify({ token: analyticsToken, spa: true });
    document.head.appendChild(beacon);
  }

  // Demo video only loads once it is near the screen, and only if the file exists.
  const video = document.querySelector('.demo-video video');
  if (video?.dataset.src) {
    const loadVideo = () => {
      const source = document.createElement('source');
      source.src = video.dataset.src;
      source.type = 'video/mp4';
      video.appendChild(source);
      video.load();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.autoplay = true;
        video.play().catch(() => {});
      }
    };
    if ('IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          videoObserver.disconnect();
          loadVideo();
        }
      }, { rootMargin: '200px' });
      videoObserver.observe(video);
    } else loadVideo();
  }

  // Real signup count, only shown once the API says it is big enough.
  const counters = document.querySelectorAll('.signup-count');
  fetch('/api/waitlist/count')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || typeof data.count !== 'number') return;
      const text = `Join ${data.count.toLocaleString('en-GB')} people already on the waitlist.`;
      counters.forEach((el) => { el.textContent = text; el.hidden = false; });
    })
    .catch(() => {});

  const params = new URLSearchParams(window.location.search);
  const source = ['utm_source', 'utm_medium', 'utm_campaign']
    .map((key) => params.get(key))
    .filter(Boolean)
    .join(' / ') || params.get('ref') || '';

  const successMarkup = (alreadyJoined) => `
    <div class="form-success" role="status" tabindex="-1">
      <strong>${alreadyJoined ? 'You are already on the list. ♡' : 'You are on the list. Thank you. ♡'}</strong>
      <p>We will email you when there is news, and you will be first to reserve.</p>
      <button class="button button-ghost share-button" type="button">Share VELI with a friend</button>
    </div>`;

  const shareSite = async (button) => {
    const shareData = {
      title: 'VELI',
      text: 'VELI is an AI safety companion that clips to your bag. I just joined the waitlist.',
      url: window.location.origin + '/'
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        button.textContent = 'Link copied';
      }
    } catch {
      // Share sheet closed. Nothing to do.
    }
  };

  document.querySelectorAll('.waitlist-form').forEach((form) => {
    const status = form.querySelector('.form-status');
    const question = form.querySelector('.optional-question');
    const email = form.querySelector('input[name="email"]');

    // Hero form reveals the optional question once someone starts typing.
    email?.addEventListener('focus', () => { if (question) question.hidden = false; }, { once: true });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.className = 'form-status';
      const data = new FormData(form);
      const payload = {
        email: String(data.get('email') || '').trim(),
        answer: String(data.get('answer') || '').trim(),
        consent: data.get('consent') === 'on',
        website: String(data.get('website') || ''),
        referrer: document.referrer || '',
        source: source ? `${source} (${form.dataset.location})` : `website (${form.dataset.location})`
      };

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        status.textContent = 'Please enter a valid email address.';
        status.classList.add('error');
        email?.focus();
        return;
      }
      if (!payload.consent) {
        status.textContent = 'Please tick the box so we can email you.';
        status.classList.add('error');
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.textContent = 'Joining…';

      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'We could not add you just now. Please try again.');

        form.innerHTML = successMarkup(body.already_joined);
        const counter = form.nextElementSibling;
        if (counter?.classList.contains('signup-count')) counter.hidden = true;
        const success = form.querySelector('.form-success');
        success.focus({ preventScroll: true });
        success.querySelector('.share-button').addEventListener('click', (e) => shareSite(e.currentTarget));

        // Counted as a page view in Cloudflare Web Analytics. /joined also exists as a real page.
        if (analyticsToken && !body.already_joined && window.location.pathname !== '/joined') {
          history.pushState({ joined: true }, '', '/joined');
        }
      } catch (error) {
        // Network failures surface as TypeError with a browser message people should not see.
        status.textContent = error instanceof TypeError || !error.message
          ? 'We could not add you just now. Please check your connection and try again.'
          : error.message;
        status.classList.add('error');
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
