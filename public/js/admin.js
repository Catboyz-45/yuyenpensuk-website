// admin.js — อยู่เย็นเป็นสุข วิศวกรรม CMS
(function () {
  "use strict";

  /* ---------- Admin mobile drawer ---------- */
  var toggle = document.querySelector(".admin-mobile-toggle");
  var sidebar = document.querySelector("#admin-primary-nav");
  var backdrop = document.querySelector(".admin-nav-backdrop");
  if (toggle && sidebar && backdrop) {
    function setDrawer(open) {
      document.body.classList.toggle("admin-nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "ปิดเมนูผู้ดูแล" : "เปิดเมนูผู้ดูแล");
    }
    toggle.addEventListener("click", function () {
      setDrawer(!document.body.classList.contains("admin-nav-open"));
    });
    backdrop.addEventListener("click", function () { setDrawer(false); });
    sidebar.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setDrawer(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setDrawer(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setDrawer(false);
    });
  }

  /* ---------- กรองหมวดหมู่สินค้าตามยี่ห้อ ---------- */
  // ชิปมี data-brand-target="brand-N" (หรือ "all" เพื่อโชว์ทั้งหมด)
  var chips = document.querySelectorAll("[data-brand-target]");
  var panels = document.querySelectorAll("[data-brand-panel]");
  if (chips.length && panels.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var target = chip.getAttribute("data-brand-target");
        chips.forEach(function (c) { c.classList.remove("dim"); });
        if (target === "all") {
          panels.forEach(function (p) { p.style.display = ""; });
        } else {
          chips.forEach(function (c) {
            if (c !== chip && c.getAttribute("data-brand-target") !== "all") c.classList.add("dim");
          });
          panels.forEach(function (p) {
            p.style.display = p.getAttribute("data-brand-panel") === target ? "" : "none";
          });
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }
})();
