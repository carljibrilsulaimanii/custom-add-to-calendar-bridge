/*
  Free Class Calendar Button -- module.js (v2.0.0)
  Author:  Jibril Sulaiman
  Date:    2026-10-19
  Deploy:  Design Manager > "Free Class Calendar Button" > JS pane. HubSpot
           loads a module's JS once per page, however many copies the page has.
  What:    Turns each "Add To Calendar" link the module draws into a menu
           toggle: opens above the button (below it near the top of the
           screen), closes on Escape, the x, or a click outside. A URL ending
           in #addtocalendar opens the first VISIBLE menu, so the hidden
           desktop or mobile copy of a duplicated hero section is skipped.
  Why:     Same behavior as the GoHighLevel AddEvent-style dropdown (v2.5),
           without the late-render rescans: HubSpot renders modules on the
           server, so the links already exist when this runs.
*/
(function () {
  var LOG = '[FC Calendar v2.0]';
  var OPEN = 'fcatc-menu--open';
  var BELOW = 'fcatc-menu--below';

  function menus() {
    return document.querySelectorAll('.fcatc-menu');
  }

  function closeAll() {
    var all = menus();
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove(OPEN);
      all[i].hidden = true;
      var t = all[i].previousElementSibling;
      if (t && t.hasAttribute('data-fcatc-toggle')) t.setAttribute('aria-expanded', 'false');
    }
  }

  function open(toggle, menu) {
    closeAll();
    menu.hidden = false;
    menu.classList.add(OPEN);
    toggle.setAttribute('aria-expanded', 'true');
    if (toggle.getBoundingClientRect().top < 300) {
      menu.classList.add(BELOW);
    } else {
      menu.classList.remove(BELOW);
    }
  }

  function attach(toggle) {
    if (toggle.getAttribute('data-fcatc-bound') === 'true') return;
    var menu = toggle.nextElementSibling;
    if (!menu || !menu.classList.contains('fcatc-menu')) return;
    toggle.setAttribute('data-fcatc-bound', 'true');
    if (toggle.parentElement) toggle.parentElement.classList.add('fcatc-anchor');

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains(OPEN)) {
        closeAll();
      } else {
        open(toggle, menu);
      }
    });

    var close = menu.querySelector('.fcatc-close');
    if (close) {
      close.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeAll();
        toggle.focus();
      });
    }

    var items = menu.querySelectorAll('.fcatc-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        setTimeout(closeAll, 0);
      });
    }
  }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function openFromHash() {
    if (window.location.hash.toLowerCase() !== '#addtocalendar') return;
    var toggles = document.querySelectorAll('[data-fcatc-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      if (isVisible(toggles[i])) {
        open(toggles[i], toggles[i].nextElementSibling);
        return;
      }
    }
  }

  function init() {
    var toggles = document.querySelectorAll('[data-fcatc-toggle]');
    for (var i = 0; i < toggles.length; i++) attach(toggles[i]);
    console.log(LOG, 'Attached to', toggles.length, 'button(s)');
    openFromHash();
  }

  document.addEventListener('click', function (e) {
    var openMenus = document.querySelectorAll('.fcatc-menu.' + OPEN);
    for (var i = 0; i < openMenus.length; i++) {
      var anchor = openMenus[i].parentElement;
      if (anchor && !anchor.contains(e.target)) closeAll();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  window.addEventListener('hashchange', openFromHash);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
