// Sanace site scripts

var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReduced) {
  document.documentElement.classList.add('no-motion');
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
// full-opacity (.is-active), and which dot is lit.
var workCarousel = document.querySelector('.work-carousel');
var workTrack = document.getElementById('workTrack');
var workDots = document.getElementById('workDots');
var activeIndex = 0;

function getVisibleWorkItems() {
  return Array.prototype.filter.call(workTrack.children, function (el) {
    return !el.hidden;
  });
}

function renderCarousel() {
  var items = getVisibleWorkItems();
  if (items.length === 0) return;
  activeIndex = Math.max(0, Math.min(activeIndex, items.length - 1));

  items.forEach(function (item, i) {
    item.classList.toggle('is-active', i === activeIndex);
  });

  workDots.innerHTML = '';
  items.forEach(function (item, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'work-dot' + (i === activeIndex ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Go to project ' + (i + 1));
    dot.addEventListener('click', function () {
      activeIndex = i;
      renderCarousel();
    });
    workDots.appendChild(dot);
  });

  var active = items[activeIndex];
  var offset = workCarousel.clientWidth / 2 - (active.offsetLeft + active.offsetWidth / 2);
  workTrack.style.transform = 'translateX(' + offset + 'px)';
}

function stepCarousel(delta) {
  var items = getVisibleWorkItems();
  if (items.length === 0) return;
  activeIndex = (activeIndex + delta + items.length) % items.length;
  renderCarousel();
}

if (workCarousel && workTrack && workDots) {
  document.querySelector('.work-arrow-prev').addEventListener('click', function () {
    stepCarousel(-1);
  });
  document.querySelector('.work-arrow-next').addEventListener('click', function () {
    stepCarousel(1);
  });

  workTrack.querySelectorAll('.work-item').forEach(function (item) {
    item.addEventListener('click', function () {
      if (!item.classList.contains('is-active')) {
        activeIndex = getVisibleWorkItems().indexOf(item);
        renderCarousel();
      }
    });
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
