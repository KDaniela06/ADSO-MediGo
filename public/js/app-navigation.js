document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.querySelector("[data-app-navigation-toggle]");
  const drawer = document.querySelector("[data-app-navigation]");
  const backdrop = document.querySelector("[data-app-navigation-backdrop]");
  const closeButton = document.querySelector("[data-app-navigation-close]");

  if (!toggle || !drawer || !backdrop) return;

  function getFocusableElements() {
    return Array.from(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'));
  }

  function closeNavigation({ restoreFocus = true } = {}) {
    document.body.classList.remove("app-navigation-open");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");
    backdrop.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    if (restoreFocus) toggle.focus();
  }

  function openNavigation() {
    document.body.classList.add("app-navigation-open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.removeAttribute("inert");
    backdrop.classList.remove("hidden");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú de navegación");
    const [firstFocusable] = getFocusableElements();
    if (firstFocusable) firstFocusable.focus();
  }

  toggle.addEventListener("click", function () {
    if (toggle.getAttribute("aria-expanded") === "true") closeNavigation({ restoreFocus: false });
    else openNavigation();
  });

  if (closeButton) closeButton.addEventListener("click", closeNavigation);
  backdrop.addEventListener("click", closeNavigation);

  drawer.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      closeNavigation({ restoreFocus: false });
    });
  });

  document.addEventListener("keydown", function (event) {
    if (!document.body.classList.contains("app-navigation-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeNavigation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
});
