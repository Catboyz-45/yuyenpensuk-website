(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const editor = document.querySelector('.banana-editor');
  const list = document.getElementById('banana-list-view');
  if (!editor || !list) return;
  const showEditor = params.has('add') || params.has('edit') || location.hash === '#add-form';
  const selectedBrand = params.get('brand') || '';

  // หน้าเลือกแบรนด์ / รายการสินค้าในแบรนด์ที่เลือก
  function setupBrandView() {
    const grid = document.getElementById('banana-brand-grid');
    const products = document.getElementById('banana-brand-products');
    if (!grid || !products) return;
    grid.hidden = !!selectedBrand;
    products.hidden = !selectedBrand;
    const heading = document.getElementById('banana-selected-title');
    const add = document.getElementById('banana-brand-add');
    if (heading) heading.textContent = selectedBrand;
    if (add) add.href = '/admin/products?add=1&brand=' + encodeURIComponent(selectedBrand);
  }

  // สลับระหว่างตารางสินค้ากับฟอร์มเพิ่ม/แก้ไข
  function setupEditorView() {
    editor.hidden = !showEditor;
    list.hidden = showEditor;
    const toolbar = document.querySelector('.banana-toolbar');
    if (!toolbar || !showEditor) return;
    const heading = toolbar.querySelector('h2');
    if (heading) heading.textContent = params.has('edit') ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่';
  }

  // ค้นหาและกรองแถวสินค้าตามคำค้นและแบรนด์
  function setupFilter() {
    const search = document.getElementById('banana-search');
    const brand = document.getElementById('banana-brand-filter');
    if (!search || !brand) return;
    const rows = [...document.querySelectorAll('[data-banana-product]')];
    const count = document.getElementById('banana-count');
    const empty = document.getElementById('banana-empty');
    const matches = (row) => {
      const term = search.value.trim().toLowerCase();
      const textOk = !search.value || row.dataset.search.includes(term);
      return textOk && (!brand.value || row.dataset.brand === brand.value);
    };
    function filter() {
      let shown = 0;
      rows.forEach((row) => {
        const ok = matches(row);
        row.hidden = !ok;
        if (ok) shown++;
      });
      count.textContent = shown + ' รายการ';
      empty.hidden = shown !== 0;
    }
    if (selectedBrand) brand.value = selectedBrand;
    filter();
    search.addEventListener('input', filter);
    brand.addEventListener('change', filter);
  }

  // แท็บของฟอร์มสินค้า และพาไปยังแท็บที่มีช่องกรอกไม่ครบเมื่อกดบันทึก
  function setupTabs() {
    const tabs = [...document.querySelectorAll('.banana-tab')];
    const sections = [...document.querySelectorAll('[data-section]')];
    function selectTab(name) {
      tabs.forEach((t) => {
        const active = t.dataset.tab === name;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      sections.forEach((s) => { s.hidden = s.dataset.section !== name; });
    }
    tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));
    selectTab('basic');
    const form = document.querySelector('.banana-edit-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      const invalid = form.querySelector(':invalid');
      if (!invalid) return;
      const section = invalid.closest('[data-section]');
      if (section) selectTab(section.dataset.section);
      invalid.focus();
      e.preventDefault();
    });
  }

  setupBrandView();
  setupEditorView();
  setupFilter();
  setupTabs();
})();
