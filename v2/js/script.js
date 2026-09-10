var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  document.documentElement.classList.add('no-motion');
}

// Theme toggle -- a soft cross-fade between the old and new theme via the
// View Transitions API, instead of an instant hard cut. Falls back to a
// plain instant swap where unsupported.
var themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition || prefersReduced) {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      return;
    }

    document.startViewTransition(function () {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  });
}

// Magnetic hover (same mechanism as v1's .pill-btn, css/style.css) --
// every clickable button/link in v2 pulls slightly toward the cursor.
if (!prefersReduced && window.matchMedia('(pointer: fine)').matches) {
  function applyMagnetic(selector, maxOffset, extraTransform) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var relX = (e.clientX - rect.left) / rect.width - 0.5;
        var relY = (e.clientY - rect.top) / rect.height - 0.5;
        var move = 'translate(' + (relX * maxOffset * 2) + 'px, ' + (relY * maxOffset * 2) + 'px)';
        el.style.transform = extraTransform ? extraTransform + ' ' + move : move;
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  applyMagnetic('.header-contact-btn, .header-wordmark, .btn-primary, .pill-btn', 8);
  applyMagnetic('.card-link, .case-related-item, .storyboard-item, .storyboard-stack', 6, 'translateY(-4px)');
  applyMagnetic('.theme-toggle', 5);
  applyMagnetic('.feed-filter-btn', 5);
  applyMagnetic('.hero-link, .section-marker a', 6);
  applyMagnetic('.social-text-link', 6, 'translateY(-3px)');
}

// Measure each hero-name flip-letter's actual "old"/"new" glyph widths,
// so each letter's box is exactly as wide as whichever glyph it's showing
// (rather than padded out to match its widest sibling) -- the word's total
// width is allowed to shift slightly during the hover roll as a result.
function measureFlipLetters() {
  var heroName = document.querySelector('.hero-name');
  if (!heroName) return;
  var letters = Array.prototype.slice.call(heroName.querySelectorAll('.flip-letter'));
  if (!letters.length) return;

  var probe = document.createElement('span');
  var heroStyle = getComputedStyle(heroName);
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'pre';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.fontFamily = heroStyle.fontFamily;
  probe.style.fontWeight = heroStyle.fontWeight;
  probe.style.fontSize = heroStyle.fontSize;
  probe.style.letterSpacing = heroStyle.letterSpacing;
  document.body.appendChild(probe);

  letters.forEach(function (letter) {
    var glyphs = letter.querySelectorAll('.flip-glyph');
    if (glyphs.length < 2) return;
    var oldText = glyphs[0].textContent;
    var newText = glyphs[1].textContent;

    probe.textContent = oldText;
    var wOld = probe.getBoundingClientRect().width;
    probe.textContent = newText;
    var wNew = probe.getBoundingClientRect().width;

    var pad = 2; // matches .flip-glyph's small horizontal padding
    letter.style.setProperty('--w-old', (wOld + pad) + 'px');
    letter.style.setProperty('--w-new', (wNew + pad) + 'px');
  });

  probe.remove();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(measureFlipLetters);
} else {
  measureFlipLetters();
}
window.addEventListener('resize', measureFlipLetters);

// Sanjay -> Sanace hover roll: start looping on mouseenter; on mouseleave,
// don't cut the animation off mid-roll -- let each letter finish its
// current cycle (each one naturally passes back through the resting
// "Sanjay" frame once per loop) and settle there instead of snapping.
(function () {
  var heroNameEl = document.querySelector('.hero-name');
  if (!heroNameEl) return;
  var flipLetterEls = Array.prototype.slice.call(heroNameEl.querySelectorAll('.flip-letter'));
  if (!flipLetterEls.length) return;

  heroNameEl.addEventListener('mouseenter', function () {
    flipLetterEls.forEach(function (letter) {
      letter.dataset.pendingStop = '';
      letter.classList.add('is-flipping');
    });
  });

  heroNameEl.addEventListener('mouseleave', function () {
    flipLetterEls.forEach(function (letter) {
      letter.dataset.pendingStop = '1';
    });
  });

  flipLetterEls.forEach(function (letter) {
    letter.addEventListener('animationiteration', function () {
      if (letter.dataset.pendingStop === '1') {
        letter.classList.remove('is-flipping');
        letter.dataset.pendingStop = '';
      }
    });
  });

  // Auto-play the roll once on a fresh page load -- same start/settle
  // sequence as a hover-in-then-out, just triggered by us instead of the
  // pointer, so first-time visitors see the Sanjay -> Sanace reveal
  // without needing to find and hover the name.
  if (!prefersReduced) {
    flipLetterEls.forEach(function (letter) {
      letter.dataset.pendingStop = '';
      letter.classList.add('is-flipping');
    });
    setTimeout(function () {
      flipLetterEls.forEach(function (letter) {
        letter.dataset.pendingStop = '1';
      });
    }, 1600);
  }
})();

// Feed filter tabs + sliding underline
var feedGrid = document.getElementById('feedGrid');
var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.feed-filter-btn'));
var underline = document.querySelector('.feed-filter-underline');

function moveUnderline(btn) {
  if (!underline || !btn) return;
  underline.style.width = btn.offsetWidth + 'px';
  underline.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
}

function setFilter(value, btn) {
  filterBtns.forEach(function (b) {
    b.classList.toggle('is-active', b === btn);
  });
  moveUnderline(btn);

  var cards = Array.prototype.slice.call(document.querySelectorAll('.card-wrap'));
  cards.forEach(function (card) {
    var type = card.getAttribute('data-type');
    card.hidden = !(value === 'all' || type === value);
  });
  layoutBento();
}

filterBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    setFilter(btn.getAttribute('data-filter-value'), btn);
  });
});

var activeBtn = document.querySelector('.feed-filter-btn.is-active');
if (activeBtn) {
  requestAnimationFrame(function () { moveUnderline(activeBtn); });
}
window.addEventListener('resize', function () {
  var current = document.querySelector('.feed-filter-btn.is-active');
  if (current) moveUnderline(current);
});

// Bento grid: row-span per card computed from its real aspect ratio,
// same technique as the Fine Arts gallery (css/style.css .fine-art-grid).
function layoutBento() {
  if (!feedGrid) return;
  var gridStyles = getComputedStyle(feedGrid);
  var rowUnit = parseFloat(gridStyles.gridAutoRows);
  var gap = parseFloat(gridStyles.rowGap || gridStyles.gap) || 0;

  Array.prototype.slice.call(feedGrid.querySelectorAll('.card-wrap')).forEach(function (card) {
    if (card.hidden) return;
    var aspect = parseFloat(card.getAttribute('data-aspect')) || 1;
    var rect = card.getBoundingClientRect();
    if (!rect.width) return;
    var renderedHeight = rect.width / aspect;
    var rowSpan = Math.max(1, Math.ceil((renderedHeight + gap) / (rowUnit + gap)));
    card.style.gridRowEnd = 'span ' + rowSpan;
  });
}

layoutBento();
var bentoResizeTimer;
window.addEventListener('resize', function () {
  clearTimeout(bentoResizeTimer);
  bentoResizeTimer = setTimeout(layoutBento, 150);
});

// Card entrance animation (rise-in once, first time scrolled into view)
if (!prefersReduced && 'IntersectionObserver' in window) {
  var cardObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          cardObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll('.card-wrap').forEach(function (el) {
    cardObserver.observe(el);
  });
} else {
  document.querySelectorAll('.card-wrap').forEach(function (el) {
    el.classList.add('is-visible');
  });
}

// LQIP crossfade: fade out the blurred placeholder once the real image loads
document.querySelectorAll('.card-img').forEach(function (img) {
  if (img.complete && img.naturalWidth > 0) {
    img.classList.add('is-loaded');
  } else {
    img.addEventListener('load', function () {
      img.classList.add('is-loaded');
    });
  }
});

// Progressive reveal: message -> name -> contact method -> submit
(function () {
  var fieldMessage = document.getElementById('fieldMessage');
  var fieldName = document.getElementById('fieldName');
  var stepName = document.getElementById('stepName');
  var stepContact = document.getElementById('stepContact');
  var stepSubmit = document.getElementById('stepSubmit');
  var fieldContact = document.getElementById('contactValue');

  function reveal(el) {
    if (el) el.classList.add('is-visible');
  }

  if (fieldMessage && stepName) {
    fieldMessage.addEventListener('input', function () {
      if (fieldMessage.value.trim().length > 0) reveal(stepName);
    });
  }
  if (fieldName && stepContact) {
    fieldName.addEventListener('input', function () {
      if (fieldName.value.trim().length > 0) reveal(stepContact);
    });
  }
  if (fieldContact && stepSubmit) {
    fieldContact.addEventListener('input', function () {
      if (fieldContact.value.trim().length > 0) reveal(stepSubmit);
    });
  }
})();

// Contact method toggle (Email / Phone)
var contactMethodRadios = document.querySelectorAll('input[name="contactMethod"]');
var contactValueInput = document.getElementById('contactValue');
var contactValueLabel = document.getElementById('contactValueLabel');
if (contactValueInput && contactValueLabel) {
  contactMethodRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.value === 'Phone' && radio.checked) {
        contactValueInput.type = 'tel';
        contactValueInput.placeholder = '+91 XXXXX XXXXX';
      } else if (radio.checked) {
        contactValueInput.type = 'email';
        contactValueInput.placeholder = 'you@example.com';
      }
    });
  });
}

// Contact form submit (Web3Forms)
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
          contactForm.reset();
        } else {
          contactFormStatus.textContent = 'Something went wrong. Please try emailing snjy.ace@gmail.com directly.';
        }
        submitBtn.disabled = false;
      })
      .catch(function () {
        contactFormStatus.hidden = false;
        contactFormStatus.textContent = 'Something went wrong. Please try emailing snjy.ace@gmail.com directly.';
        submitBtn.disabled = false;
      });
  });
}
