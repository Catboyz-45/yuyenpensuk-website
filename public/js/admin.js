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

  /* ---------- ยืนยันก่อนส่งฟอร์มลบ/รีเซ็ต (TC-020) ----------
   * ใช้ data-confirm แทน onsubmit ในหน้า EJS เพราะ CSP ของระบบไม่อนุญาตสคริปต์ในแท็ก HTML */
  document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
})();
