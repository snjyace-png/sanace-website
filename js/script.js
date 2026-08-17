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
