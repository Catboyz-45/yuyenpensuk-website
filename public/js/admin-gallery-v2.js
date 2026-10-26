/* Yuyenpensuk product gallery editor: browser-only controls, no automatic save. */
(function () {
  'use strict';
  const form = document.querySelector('form[action="/admin/products/save"]');
  if (!form) return;
  const galleryInput = form.querySelector('input[name="gallery"]');
  const orderInput = form.querySelector('input[name="galleryOrder"]');
  const savedBox = form.querySelector('.admin-saved-gallery');
  if (!galleryInput || !orderInput) return;
  const section = galleryInput.closest('.fld');
  const editor = document.createElement('section');
  editor.className = 'yy-gallery-editor';
  editor.setAttribute('aria-label', 'จัดลำดับรูปแกลเลอรีสินค้า');
  section.insertBefore(editor, galleryInput.nextSibling);
  let newFiles = [];
  let savedUrls = savedBox ? Array.from(savedBox.querySelectorAll('img')).map(img => img.getAttribute('src')) : [];
  function move(list, index, delta) {
    const dest = index + delta;
    if (dest < 0 || dest >= list.length) return;
    [list[index], list[dest]] = [list[dest], list[index]];
  }
  function syncFiles() {
    if (!newFiles.length) return;
    const transfer = new DataTransfer();
    newFiles.forEach(file => transfer.items.add(file));
    galleryInput.files = transfer.files;
  }
  function render() {
    editor.replaceChildren();
    const isNew = newFiles.length > 0;
    const current = isNew ? newFiles : savedUrls;
    if (!current.length) return;
    const help = document.createElement('p');
    help.className = 'hint';
    help.textContent = isNew ? 'เรียงรูปที่เลือกใหม่ก่อนบันทึก (การอัปโหลดชุดใหม่จะแทนที่แกลเลอรีเดิม)' : 'เรียงรูปแกลเลอรีเดิมได้โดยไม่ต้องอัปโหลดใหม่';
    editor.appendChild(help);
    const grid = document.createElement('div');
    grid.className = 'admin-gallery-sort';
    current.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'admin-gallery-item';
      const img = document.createElement('img');
      img.alt = 'รูปแกลเลอรีลำดับ ' + (i + 1);
      if (isNew) {
        const url = URL.createObjectURL(item);
        img.src = url;
        img.addEventListener('load', () => URL.revokeObjectURL(url), {once:true});
      } else img.src = item;
      const label = document.createElement('small');
      label.textContent = 'รูปที่ ' + (i + 1);
      const actions = document.createElement('div');
      actions.className = 'admin-photo-controls';
      [['เลื่อนขึ้น', -1], ['เลื่อนลง', 1]].forEach(([name, delta]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = delta < 0 ? '←' : '→';
        btn.setAttribute('aria-label', name + ' รูปที่ ' + (i + 1));
        btn.title = name;
        btn.disabled = i + delta < 0 || i + delta >= current.length;
        btn.addEventListener('click', () => {
          move(current, i, delta);
          if (isNew) syncFiles();
          else orderInput.value = JSON.stringify(savedUrls);
          render();
        });
        actions.appendChild(btn);
      });
      card.append(img, label, actions);
      grid.appendChild(card);
    });
    editor.appendChild(grid);
  }
  galleryInput.addEventListener('change', () => {
    newFiles = Array.from(galleryInput.files || []);
    orderInput.value = '';
    render();
  });
  form.addEventListener('submit', () => {
    if (newFiles.length) syncFiles();
    else if (savedUrls.length && orderInput.value) orderInput.value = JSON.stringify(savedUrls);
  });
  render();
})();
