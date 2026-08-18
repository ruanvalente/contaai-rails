const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (!prefersReducedMotion) {
  let exitTimeout;

  document.addEventListener("turbo:before-render", (event) => {
    const morphVariant = event.detail?.newBody?.querySelector(
      "[data-turbo-variant]",
    );

    if (morphVariant) return;

    document.body.classList.add("turbo-exiting");
  });

  document.addEventListener("turbo:render", () => {
    clearTimeout(exitTimeout);
    exitTimeout = setTimeout(() => {
      document.body.classList.remove("turbo-exiting");
      document.body.classList.add("turbo-entering");
    }, 20);
  });

  document.addEventListener("turbo:load", () => {
    clearTimeout(exitTimeout);
    document.body.classList.remove("turbo-entering");
  });

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
