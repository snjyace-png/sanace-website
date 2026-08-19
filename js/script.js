// Sanace site scripts

var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReduced) {
  document.documentElement.classList.add('no-motion');
}

// Showreel: don't autoplay for reduced-motion users, same as the marquee
var showreelVideo = document.querySelector('.showreel-video');
if (showreelVideo && prefersReduced) {
  showreelVideo.pause();
}

// Header collapses to a small floating pill once the hero has been fully
// taken over by the next sticky-stacked section, and expands back when
// scrolling back up to it. Triggered by an IntersectionObserver on a plain
// (non-sticky) sentinel sitting exactly at hero's bottom edge, rather than
// observing .hero itself -- .hero is position:sticky, so it geometrically
// stays "intersecting" the viewport far longer than it takes to visually
// get covered by the next section, which is why that approach didn't work.
var siteHeaderEl = document.querySelector('.site-header');
var heroSentinel = document.querySelector('.hero-sentinel');
if (siteHeaderEl && heroSentinel && 'IntersectionObserver' in window) {
  var headerCollapseObserver = new IntersectionObserver(function (entries) {
    siteHeaderEl.classList.toggle('is-collapsed', !entries[0].isIntersecting);
  });
  headerCollapseObserver.observe(heroSentinel);
}

// Theme toggle
var themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', function () {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// Local time ticker (IST)
var localTimeEl = document.getElementById('localTime');
var timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});
function updateLocalTime() {
  localTimeEl.textContent = timeFormatter.format(new Date());
}
updateLocalTime();
setInterval(updateLocalTime, 1000);

// Smooth scroll (Lenis)
if (!prefersReduced && window.Lenis) {
  var lenis = new window.Lenis();
  requestAnimationFrame(function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  });
}

// Scroll-reveal (siblings within the same parent stagger in)
var revealGroupCounts = new Map();
document.querySelectorAll('.reveal').forEach(function (el) {
  var index = revealGroupCounts.get(el.parentElement) || 0;
  el.style.transitionDelay = (index * 80) + 'ms';
  revealGroupCounts.set(el.parentElement, index + 1);
});

if (!prefersReduced && 'IntersectionObserver' in window) {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
} else {
  document.querySelectorAll('.reveal').forEach(function (el) {
    el.classList.add('is-visible');
  });
}

// Work carousel: centered "peek" carousel -- one active card centered, the
// rest dimmed/shrunk peeking at the edges. activeIndex drives everything:
// which card is centered (via .work-track's translateX), which one is
// full-opacity (.is-active), and which dot is lit. A clone of the first
// card is appended after the last (and a clone of the last is prepended
// before the first), so stepping past either end has somewhere to slide
// onto that continues in the same direction -- see stepCarousel.
var workCarousel = document.querySelector('.work-carousel');
var workTrack = document.getElementById('workTrack');
var workDots = document.getElementById('workDots');
var activeIndex = 0;

function getVisibleWorkItems() {
  return Array.prototype.filter.call(workTrack.querySelectorAll('.work-item:not(.is-clone)'), function (el) {
    return !el.hidden;
  });
}

function rebuildClones() {
  Array.prototype.slice.call(workTrack.querySelectorAll('.work-item.is-clone')).forEach(function (el) {
    el.remove();
  });

  var items = getVisibleWorkItems();
  if (items.length < 2) return;

  var firstClone = items[0].cloneNode(true);
  firstClone.classList.add('is-clone');
  firstClone.setAttribute('aria-hidden', 'true');
  firstClone.setAttribute('tabindex', '-1');
  workTrack.appendChild(firstClone);

  var lastClone = items[items.length - 1].cloneNode(true);
  lastClone.classList.add('is-clone');
  lastClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('tabindex', '-1');
  workTrack.insertBefore(lastClone, items[0]);
}

// Sets .is-active on the current card, and keeps the two boundary clones in
// sync with whichever real end is active -- so there's no opacity/scale
// "pop" the instant moveTrackTo snaps from a clone to its real counterpart.
function updateActiveClasses(items) {
  items.forEach(function (item, i) {
    item.classList.toggle('is-active', i === activeIndex);
  });
  if (items.length > 1) {
    var trailingClone = workTrack.lastElementChild;
    var leadingClone = workTrack.firstElementChild;
    if (trailingClone && trailingClone.classList.contains('is-clone')) {
      trailingClone.classList.toggle('is-active', activeIndex === 0);
    }
    if (leadingClone && leadingClone.classList.contains('is-clone')) {
      leadingClone.classList.toggle('is-active', activeIndex === items.length - 1);
    }
  }
}

function updateDots(items) {
  workDots.innerHTML = '';
  items.forEach(function (item, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'work-dot' + (i === activeIndex ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Go to project ' + (i + 1));
    dot.addEventListener('click', function () {
      var current = getVisibleWorkItems();
      activeIndex = i;
      updateActiveClasses(current);
      updateDots(current);
      moveTrackTo(workTrack.children[current.length > 1 ? activeIndex + 1 : activeIndex], false);
    });
    workDots.appendChild(dot);
  });
}

// Centers `target` in the carousel's viewport. instant=true disables the
// transition for one frame first, so the move happens with no animation --
// used for the invisible clone -> real card snap once a wrap slide lands.
function moveTrackTo(target, instant) {
  if (!target) return;
  if (instant) {
    workTrack.classList.add('no-transition');
    void workTrack.offsetWidth;
  }
  var offset = workCarousel.clientWidth / 2 - (target.offsetLeft + target.offsetWidth / 2);
  workTrack.style.transform = 'translateX(' + offset + 'px)';
  if (instant) {
    void workTrack.offsetWidth;
    workTrack.classList.remove('no-transition');
  }
}

function renderCarousel() {
  rebuildClones();
  var items = getVisibleWorkItems();
  if (items.length === 0) return;
  activeIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
  updateActiveClasses(items);
  updateDots(items);
  moveTrackTo(workTrack.children[items.length > 1 ? activeIndex + 1 : activeIndex], false);
}

function stepCarousel(delta) {
  var items = getVisibleWorkItems();
  if (items.length === 0) return;
  var raw = activeIndex + delta;
  var wrapped = raw >= items.length || raw < 0;
  activeIndex = ((raw % items.length) + items.length) % items.length;

  updateActiveClasses(items);
  updateDots(items);

  var hasClones = items.length > 1;
  if (wrapped && hasClones) {
    var clone = delta > 0 ? workTrack.lastElementChild : workTrack.firstElementChild;
    moveTrackTo(clone, false);
    workTrack.addEventListener('transitionend', function onEnd(e) {
      if (e.target !== workTrack) return;
      workTrack.removeEventListener('transitionend', onEnd);
      moveTrackTo(workTrack.children[activeIndex + 1], true);
    });
  } else {
    moveTrackTo(workTrack.children[hasClones ? activeIndex + 1 : activeIndex], false);
  }
}

if (workCarousel && workTrack && workDots) {
  document.querySelector('.work-arrow-prev').addEventListener('click', function () {
    stepCarousel(-1);
  });
  document.querySelector('.work-arrow-next').addEventListener('click', function () {
    stepCarousel(1);
  });

  // Each card's title links to its own project page. A card's first click
  // should always center it -- even if the title link is what was clicked --
  // and only a click on an already-centered card's link should navigate.
  workTrack.addEventListener('click', function (e) {
    var item = e.target.closest('.work-item');
    if (!item || item.classList.contains('is-clone')) return;

    if (!item.classList.contains('is-active')) {
      e.preventDefault();
      var items = getVisibleWorkItems();
      var index = items.indexOf(item);
      if (index === -1) return;
      activeIndex = index;
      updateActiveClasses(items);
      updateDots(items);
      moveTrackTo(workTrack.children[items.length > 1 ? activeIndex + 1 : activeIndex], false);
      return;
    }

    // Card is already centered -- clicking anywhere on it opens its page
    // (a click directly on the title link already navigates natively).
    if (e.target.closest('a')) return;
    var link = item.querySelector('.work-title a');
    if (link) {
      window.location.href = link.href;
    }
  });

  // Mouse wheel over the cards steps the carousel instead of scrolling the
  // page; off the cards, the page scrolls normally as usual. Debounced so
  // one wheel gesture reliably moves one card, matching the arrow/dot step.
  var wheelCooldown = false;
  workCarousel.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (wheelCooldown) return;
    var delta = e.deltaY + e.deltaX;
    if (Math.abs(delta) < 12) return;
    wheelCooldown = true;
    stepCarousel(delta > 0 ? 1 : -1);
    setTimeout(function () { wheelCooldown = false; }, 400);
  }, { passive: false });

  // Touch swipe steps the carousel the same way wheel does -- wheel events
  // don't fire from touch scrolling, so without this there's no way to
  // navigate the cards on a phone/tablet.
  var touchStartX = null;
  workCarousel.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  workCarousel.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var deltaX = touchStartX - e.changedTouches[0].clientX;
    touchStartX = null;
    if (Math.abs(deltaX) < 40) return;
    stepCarousel(deltaX > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener('resize', renderCarousel);
  renderCarousel();
}

// Work section category filter
var filterBtns = document.querySelectorAll('.filter-btn');
var workItems = document.querySelectorAll('.work-item');
filterBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    filterBtns.forEach(function (b) {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');

    var filter = btn.dataset.filter;
    workItems.forEach(function (item) {
      item.hidden = filter !== 'all' && item.dataset.category !== filter;
    });

    activeIndex = 0;
    renderCarousel();
  });
});

// Work section: floating button scrolls down to the next section
var nextSectionBtn = document.querySelector('.next-section-btn');
if (nextSectionBtn) {
  nextSectionBtn.addEventListener('click', function () {
    var about = document.getElementById('about');
    if (about) {
      about.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  });
}

// Contact form -- submits to Web3Forms (free tier) via fetch so visitors
// get an inline confirmation without leaving the page. Needs a real access
// key from web3forms.com pasted into the form's hidden "access_key" field.
// Contact form: the "reach you" field switches between email and phone
// depending on which radio is picked, so only one contact field shows at a time
var contactMethodRadios = document.querySelectorAll('input[name="contactMethod"]');
var contactValueInput = document.getElementById('contactValue');
var contactValueLabel = document.getElementById('contactValueLabel');
if (contactValueInput && contactValueLabel) {
  contactMethodRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.value === 'Phone' && radio.checked) {
        contactValueInput.type = 'tel';
        contactValueInput.placeholder = '(000) 000-0000';
        contactValueLabel.textContent = 'Your phone number';
      } else if (radio.checked) {
        contactValueInput.type = 'email';
        contactValueInput.placeholder = 'you@example.com';
        contactValueLabel.textContent = 'Your email';
      }
    });
  });
}

var contactForm = document.getElementById('contactForm');
var contactFormStatus = document.getElementById('contactFormStatus');
if (contactForm && contactFormStatus) {
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var submitBtn = contactForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    contactFormStatus.hidden = true;

    var payload = {};
    new FormData(contactForm).forEach(function (value, key) {
      payload[key] = value;
    });

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        contactFormStatus.hidden = false;
        if (data.success) {
          contactFormStatus.textContent = "Thanks — your message is on its way. I'll get back to you soon.";
          contactFormStatus.className = 'contact-form-status is-success';
          contactForm.reset();
        } else {
          contactFormStatus.textContent = 'Something went wrong. Please try emailing hello@sanace.com directly.';
          contactFormStatus.className = 'contact-form-status is-error';
        }
        submitBtn.disabled = false;
      })
      .catch(function () {
        contactFormStatus.hidden = false;
        contactFormStatus.textContent = 'Something went wrong. Please try emailing hello@sanace.com directly.';
        contactFormStatus.className = 'contact-form-status is-error';
        submitBtn.disabled = false;
      });
  });
}

// Magnetic pill buttons (desktop/fine-pointer only)
if (!prefersReduced && window.matchMedia('(pointer: fine)').matches) {
  var maxMagnetOffset = 8;
  document.querySelectorAll('.pill-btn').forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      btn.style.transform = 'translate(' + (relX * maxMagnetOffset * 2) + 'px, ' + (relY * maxMagnetOffset * 2) + 'px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
    });
  });
}
