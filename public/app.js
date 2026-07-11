document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("compose");
  if (wrap) {
    document.querySelectorAll("[data-compose-open]").forEach((el) => {
      el.addEventListener("click", () => {
        wrap.classList.add("open");
        const to = wrap.querySelector("input[name=to]");
        if (to) to.focus();
      });
    });
    wrap.querySelectorAll("[data-compose-close]").forEach((el) => {
      el.addEventListener("click", () => wrap.classList.remove("open"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") wrap.classList.remove("open");
    });
    const file = wrap.querySelector("input[type=file]");
    const label = wrap.querySelector(".compose-files");
    if (file && label) {
      file.addEventListener("change", () => {
        label.textContent = Array.from(file.files).map((f) => f.name).join(", ");
        label.title = label.textContent;
      });
    }
  }
  const toast = document.querySelector(".toast");
  if (toast && !toast.querySelector("a")) {
    setTimeout(() => toast.remove(), 6000);
  }
});
