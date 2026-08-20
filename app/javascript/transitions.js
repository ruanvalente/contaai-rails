const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function getVisitDirection() {
  return document.documentElement.dataset.turboVisitDirection || "none";
}

function setupPageTransitions() {
  if (prefersReducedMotion) return;

  let exitTimeout;

  document.addEventListener("turbo:before-render", (event) => {
    const morphVariant = event.detail?.newBody?.querySelector(
      "[data-turbo-variant]",
    );

    if (morphVariant) return;

    const direction = getVisitDirection();
    const wrapper = document.querySelector("[style*='view-transition-name']");

    if (wrapper) {
      wrapper.classList.remove(
        "slide-out-left",
        "slide-in-right",
        "slide-out-right",
        "slide-in-left",
      );

      if (direction === "back") {
        wrapper.classList.add("slide-out-right");
      } else {
        wrapper.classList.add("slide-out-left");
      }
    }
  });

  document.addEventListener("turbo:render", () => {
    clearTimeout(exitTimeout);
    exitTimeout = setTimeout(() => {
      const oldWrapper = document.querySelector(
        "[style*='view-transition-name']",
      );

      if (oldWrapper) {
        oldWrapper.classList.remove("slide-out-left", "slide-out-right");
      }
    }, 20);
  });

  document.addEventListener("turbo:load", () => {
    clearTimeout(exitTimeout);
    const direction = getVisitDirection();
    const wrapper = document.querySelector("[style*='view-transition-name']");

    if (wrapper) {
      wrapper.classList.remove(
        "slide-out-left",
        "slide-out-right",
        "slide-in-right",
        "slide-in-left",
      );

      if (direction === "back") {
        wrapper.classList.add("slide-in-left");
      } else {
        wrapper.classList.add("slide-in-right");
      }

      wrapper.addEventListener(
        "animationend",
        () => {
          wrapper.classList.remove("slide-in-right", "slide-in-left");
        },
        { once: true },
      );
    }
  });
}

function setupMorphTransitions() {
  if (prefersReducedMotion) return;

  document.addEventListener("turbo:before-morph-element", (event) => {
    const el = event.target;
    el.style.transition = "opacity 150ms ease-out";
    el.style.opacity = "0.6";
  });

  document.addEventListener("turbo:morph-element", (event) => {
    const el = event.target;
    el.style.transition = "opacity 150ms ease-out";
    el.style.opacity = "1";

    el.addEventListener(
      "transitionend",
      () => {
        el.style.transition = "";
        el.style.opacity = "";
      },
      { once: true },
    );
  });
}

setupPageTransitions();
setupMorphTransitions();
