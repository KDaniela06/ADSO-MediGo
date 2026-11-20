document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector("[data-patient-sidebar]");
  const overlay = document.querySelector("[data-sidebar-overlay]");
  const toggleButtons = document.querySelectorAll("[data-sidebar-toggle]");
  const logoutDialog = document.querySelector("#patient-logout-dialog");
  const openLogoutButton = document.querySelector("[data-open-logout]");
  const closeLogoutButton = document.querySelector("[data-close-logout]");

  if (!sidebar) return;

  function isMobileScreen() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function updateToggleButton(button, isExpanded, isMobile) {
    const label = isMobile
      ? (isExpanded ? "Cerrar menú" : "Abrir menú")
      : (isExpanded ? "Contraer menú" : "Expandir menú");

    button.setAttribute("aria-expanded", String(isExpanded));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  function closeMobileSidebar() {
    sidebar.setAttribute("data-open", "false");
    document.body.classList.remove("patient-menu-open");
    if (overlay) overlay.classList.add("hidden");
    toggleButtons.forEach(function (button) {
      const isExpanded = !isMobileScreen() && document.body.getAttribute("data-patient-sidebar-collapsed") !== "true";
      updateToggleButton(button, isExpanded, isMobileScreen());
    });
  }

  toggleButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (isMobileScreen()) {
        const isOpening = sidebar.getAttribute("data-open") !== "true";
        sidebar.setAttribute("data-open", String(isOpening));
        document.body.classList.toggle("patient-menu-open", isOpening);
        if (overlay) overlay.classList.toggle("hidden", !isOpening);
        updateToggleButton(button, isOpening, true);
        return;
      }

      const isCollapsing = document.body.getAttribute("data-patient-sidebar-collapsed") !== "true";
      document.body.setAttribute("data-patient-sidebar-collapsed", String(isCollapsing));
      updateToggleButton(button, !isCollapsing, false);
    });
  });

  if (overlay) {
    overlay.addEventListener("click", closeMobileSidebar);
  }

  window.addEventListener("resize", function () {
    if (!isMobileScreen()) {
      closeMobileSidebar();
    } else {
      sidebar.setAttribute("data-open", "false");
      document.body.classList.remove("patient-menu-open");
      if (overlay) overlay.classList.add("hidden");
      toggleButtons.forEach(function (button) {
        updateToggleButton(button, false, true);
      });
    }
  });

  if (isMobileScreen()) {
    closeMobileSidebar();
  } else {
    toggleButtons.forEach(function (button) {
      const isExpanded = document.body.getAttribute("data-patient-sidebar-collapsed") !== "true";
      updateToggleButton(button, isExpanded, false);
    });
  }

  if (openLogoutButton && logoutDialog) {
    openLogoutButton.addEventListener("click", function () {
      logoutDialog.showModal();
    });
  }

  if (closeLogoutButton && logoutDialog) {
    closeLogoutButton.addEventListener("click", function () {
      logoutDialog.close();
    });
  }

  if (logoutDialog) {
    logoutDialog.addEventListener("click", function (event) {
      if (event.target === logoutDialog) logoutDialog.close();
    });
  }
});
