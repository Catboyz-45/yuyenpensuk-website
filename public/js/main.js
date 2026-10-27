// main.js — อยู่เย็นเป็นสุข วิศวกรรม
(function () {
  "use strict";

  /* ---------- Accessible mobile navigation ---------- */
  var header = document.querySelector(".sh");
  var burger = header?.querySelector(".burger");
  var siteNav = header?.querySelector("#site-primary-nav");
  if (burger && siteNav) {
    function setMobileMenu(open) {
      header.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "ปิดเมนู" : "เปิดเมนู");
      var icon = burger.querySelector("iconify-icon");
      if (icon) icon.setAttribute("icon", open ? "mdi:close" : "mdi:menu");
    }
    burger.addEventListener("click", function () {
      setMobileMenu(!header.classList.contains("open"));
    });
    siteNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMobileMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMobileMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("open") && !header.contains(e.target)) setMobileMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) setMobileMenu(false);
    });
  }

  /* ---------- Lightbox: คลิกรูปดูพรีวิวแบบสมูท ---------- */
  // element ที่คลิกเปิด lightbox ต้องมี data-lightbox="กลุ่ม" และ data-src="url เต็ม"
  var groups = {};
  document.querySelectorAll("[data-lightbox]").forEach(function (el) {
    var g = el.dataset.lightbox;
    if (!groups[g]) groups[g] = [];
    groups[g].push(el);
  });

  if (Object.keys(groups).length) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML =
      '<div class="lb-img-wrap">' +
      '<img alt="">' +
      '<button class="lb-close" aria-label="ปิด" type="button"><iconify-icon icon="mdi:close"></iconify-icon></button>' +
      '<button class="lb-prev" aria-label="ก่อนหน้า" type="button"><iconify-icon icon="mdi:chevron-left"></iconify-icon></button>' +
      '<button class="lb-next" aria-label="ถัดไป" type="button"><iconify-icon icon="mdi:chevron-right"></iconify-icon></button>' +
      '<div class="lb-count"></div>' +
      "</div>";
    document.body.appendChild(lb);
    var lbImg = lb.querySelector("img");
    var lbCount = lb.querySelector(".lb-count");
    var curGroup = [];
    var curIndex = 0;

    function show(i) {
      curIndex = (i + curGroup.length) % curGroup.length;
      var srcEl = curGroup[curIndex];
      var img = srcEl.querySelector("img");
      var src = srcEl.dataset.src || (img ? img.src : "");
      lbImg.src = src;
      lbCount.textContent = curGroup.length > 1 ? (curIndex + 1) + " / " + curGroup.length : "";
    }
    function open(groupName, index) {
      curGroup = groups[groupName];
      show(index);
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    }
    Object.keys(groups).forEach(function (g) {
      groups[g].forEach(function (el, i) {
        el.style.position = el.style.position || "relative";
        el.addEventListener("click", function (e) {
          e.preventDefault();
          open(g, i);
        });
        // เติม hint ไอคอนแว่นขยายให้ hover เห็น (ถ้ายังไม่มี)
        if (!el.querySelector(".zoom-hint")) {
          el.classList.add("zoomable");
          var hint = document.createElement("span");
          hint.className = "zoom-hint";
          hint.innerHTML = '<iconify-icon icon="mdi:magnify-plus-outline"></iconify-icon>';
          el.appendChild(hint);
        }
      });
    });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(curIndex - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(curIndex + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(curIndex - 1);
      if (e.key === "ArrowRight") show(curIndex + 1);
    });
  }


  /* ---------- โหลดรูปตัวเครื่องของแต่ละรุ่น ---------- */
  (function loadVerifiedProductImages(){
    function fetchImages(id){
      return fetch('/api/product-gallery/' + encodeURIComponent(id), { headers: { 'Accept': 'application/json' } })
        .then(function(r){ return r.ok ? r.json() : {images:[]}; })
        .then(function(data){ return Array.from(new Set((data.images || []).filter(Boolean))).slice(0,5); })
        .catch(function(){ return []; });
    }

    function showCardImage(card, imgs){
      var img = card.querySelector('.product-photo-img');
      var loading = card.querySelector('.photo-loading');
      if (!img) return;
      function showUnavailable(){
        card.classList.add('product-photo-unavailable');
        if (loading) {
          loading.innerHTML = '<iconify-icon icon="mdi:air-conditioner" aria-hidden="true"></iconify-icon><span>รูปสินค้ารุ่นนี้กำลังปรับปรุง</span>';
          loading.style.display = 'flex';
          loading.setAttribute('role', 'status');
        }
      }
      if (!imgs?.length) { showUnavailable(); return; }
      var index = 0;
      function tryNext(){
        if (index >= imgs.length) { showUnavailable(); return; }
        var src = imgs[index++];
        img.onload = function(){
          img.style.display = 'block';
          card.classList.remove('product-photo-unavailable');
          if (loading) loading.style.display = 'none';
        };
        img.onerror = tryNext;
        img.loading = 'eager';
        img.src = src;
      }
      tryNext();
    }

    document.querySelectorAll('.product-photo[data-product-id]').forEach(function(card){
      var id = card.dataset.productId;
      if (!id) return;
      fetchImages(id).then(function(imgs){ showCardImage(card, imgs); });
    });

    var main = document.querySelector('.product-gallery-main[data-product-id]');
    if (!main) return;
    var id = main.dataset.productId;
    fetchImages(id).then(function(imgs){
      var img = main.querySelector('img');
      var loading = main.querySelector('.photo-loading');
      function showGalleryUnavailable(){
        main.classList.add('product-photo-unavailable');
        if (loading) {
          loading.innerHTML = '<iconify-icon icon="mdi:air-conditioner" aria-hidden="true"></iconify-icon><span>รูปสินค้ารุ่นนี้กำลังปรับปรุง</span>';
          loading.style.display = 'flex';
          loading.setAttribute('role', 'status');
        }
      }
      if (!imgs.length) { showGalleryUnavailable(); return; }
      var current = 0;
      function setMain(src){
        if (!img) return;
        img.onload = function(){ img.style.display = 'block'; if (loading) loading.style.display = 'none'; };
        img.onerror = function(){
          current += 1;
          if (current < imgs.length) setMain(imgs[current]);
          else showGalleryUnavailable();
        };
        img.src = src;
        main.dataset.src = src;
      }
      setMain(imgs[0]);

      var wrap = main.parentElement;
      var thumbs = wrap.querySelector('.gal-thumbs');
      if (!thumbs) return;
      thumbs.innerHTML = '';
      imgs.forEach(function(src,i){
        if (i === 0) return;
        var d = document.createElement('div');
        d.className = 'ph prod zoomable';
        d.dataset.lightbox = 'product';
        d.dataset.src = src;
        var im = document.createElement('img');
        im.src = src; im.alt = 'รูปตัวเครื่อง ' + (i+1);
        im.onerror = function(){ d.remove(); };
        d.appendChild(im); thumbs.appendChild(d);
        d.addEventListener('click', function(e){
          e.preventDefault();
          current = i;
          setMain(src);
        });
      });

      // Update the lightbox group after dynamic thumbnails are created.
      if (groups?.product) {
        groups.product = [main].concat(Array.from(thumbs.querySelectorAll('[data-lightbox="product"]')));
      }
    });
  })();

  /* ---------- ปุ่มเลือกยี่ห้อ: แสดงไม่เกิน 2 บรรทัด ที่เหลือพับไว้หลังปุ่ม "ดูยี่ห้อทั้งหมด" ----------
     ถ้ายี่ห้อพอดี 2 บรรทัดจะไม่มีปุ่มนี้ ยี่ห้อที่กำลังเลือกอยู่แสดงเสมอแม้อยู่ในส่วนที่พับ */
  document.querySelectorAll("[data-brand-chips]").forEach(function (box) {
    var MAX_ROWS = 2;
    var chips = Array.from(box.querySelectorAll("a.chip"));
    var expanded = false;
    var more = document.createElement("button");
    more.type = "button";
    more.className = "chip chip-more";
    more.hidden = true;
    box.appendChild(more);

    function layout() {
      chips.forEach(function (c) { c.hidden = false; });
      more.hidden = true;
      var tops = [];
      chips.forEach(function (c) {
        if (!tops.includes(c.offsetTop)) tops.push(c.offsetTop);
      });
      if (tops.length <= MAX_ROWS) return;
      more.hidden = false;
      more.setAttribute("aria-expanded", String(expanded));
      if (expanded) {
        more.textContent = "ย่อรายการยี่ห้อ";
        return;
      }
      tops.sort(function (a, b) { return a - b; });
      var lastRowTop = tops[MAX_ROWS - 1];
      var hiddenCount = 0;
      for (var i = chips.length - 1; i > 0 && more.offsetTop > lastRowTop; i--) {
        if (chips[i].classList.contains("on")) continue;
        chips[i].hidden = true;
        hiddenCount++;
      }
      more.textContent = "ดูยี่ห้อทั้งหมด (+" + hiddenCount + ")";
    }

    more.addEventListener("click", function () {
      expanded = !expanded;
      layout();
    });
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 150);
    });
    if (document.fonts) document.fonts.ready.then(layout);
    layout();
  });

  /* ---------- ค่อย ๆ ปรากฏเมื่อเลื่อนถึง (เคารพ prefers-reduced-motion) ----------
     หมายเหตุด้านความปลอดภัย: ครอบเฉพาะการ์ด/feature ย่อย ไม่ครอบทั้ง section
     เพื่อไม่ให้เนื้อหาทั้งหมดหายไปถ้า IntersectionObserver ทำงานผิดพลาด
     และมี fallback บังคับแสดงผลหลัง 1.2 วินาที เผื่อกรณี JS โหลดช้าหรือพลาด */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealEls = document.querySelectorAll(".card, .feat");
  if (!reduceMotion && "IntersectionObserver" in window && revealEls.length) {
    revealEls.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
    // ตาข่ายนิรภัย: ถ้ายังไม่ปรากฏภายใน 1.2 วิ ให้บังคับแสดงทั้งหมดกันเนื้อหาหาย
    setTimeout(function () {
      document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
        el.classList.add("in");
      });
    }, 1200);
  }
})();
