/* admin-row-editor.js — แก้ไขข้อมูลแบบตาราง (ช่องทางชำระเงิน เงื่อนไข ตารางราคา) ทีละรายการแทนการพิมพ์ " | " เอง
 * textarea[data-row-editor] ยังเป็นช่องที่ส่งไปเซิร์ฟเวอร์เหมือนเดิม: สคริปต์นี้แปลงการ์ดกลับเป็น
 * "คอลัมน์ | คอลัมน์" บรรทัดละรายการทุกครั้งที่แก้ เซิร์ฟเวอร์และฐานข้อมูลจึงไม่ต้องเปลี่ยน
 * ถ้าสคริปต์โหลดไม่ได้ ผู้ดูแลยังแก้ใน textarea แบบเดิมได้ */
(function () {
  'use strict';

  // ไอคอนที่ใช้บ่อยสำหรับช่องทางชำระเงิน พร้อมคำค้นภาษาไทย/อังกฤษ
  // ใช้ชุด mdi ชุดเดียวทั้งเว็บ ไอคอนบนหน้าเว็บจึงหน้าตาเข้ากัน
  const ICONS = [
    ['mdi:bank-outline', 'โอนผ่านธนาคาร', 'ธนาคาร โอน bank'],
    ['mdi:bank-transfer', 'โอนเงินระหว่างบัญชี', 'โอน บัญชี transfer'],
    ['mdi:qrcode', 'พร้อมเพย์ / QR Code', 'พร้อมเพย์ คิวอาร์ สแกน promptpay qr'],
    ['mdi:cash-multiple', 'เงินสด', 'เงิน สด cash money'],
    ['mdi:credit-card-outline', 'บัตรเครดิต / เดบิต', 'บัตร เครดิต เดบิต card credit debit'],
    ['mdi:credit-card-clock-outline', 'ผ่อนชำระผ่านบัตร', 'ผ่อน บัตร installment'],
    ['mdi:calendar-clock', 'แบ่งชำระเป็นงวด', 'งวด ผ่อน installment'],
    ['mdi:cellphone', 'ชำระผ่านมือถือ / Mobile Banking', 'มือถือ แอป โทรศัพท์ mobile banking'],
    ['mdi:wallet-outline', 'วอลเล็ต / ทรูมันนี่', 'วอลเล็ต กระเป๋าเงิน ทรูมันนี่ truemoney wallet'],
    ['mdi:paypal', 'PayPal', 'เพย์พาล paypal'],
    ['mdi:checkbook', 'เช็คธนาคาร', 'เช็ค cheque check'],
    ['mdi:truck-delivery-outline', 'ชำระเงินปลายทาง', 'ปลายทาง ส่งของ เก็บเงิน cod delivery'],
    ['mdi:storefront-outline', 'ชำระที่หน้าร้าน', 'ร้าน หน้าร้าน สาขา store shop'],
    ['mdi:account-hard-hat', 'ชำระกับช่างหน้างาน', 'ช่าง หน้างาน technician'],
    ['mdi:receipt-text-outline', 'ใบแจ้งหนี้ / ใบเสร็จ', 'ใบเสร็จ ใบแจ้งหนี้ invoice receipt'],
    ['mdi:file-document-outline', 'ใบกำกับภาษี / เอกสาร', 'ภาษี ใบกำกับ เอกสาร tax document'],
    ['mdi:office-building-outline', 'ชำระผ่านบริษัท / นิติบุคคล', 'บริษัท นิติบุคคล องค์กร company'],
    ['mdi:clock-outline', 'ชำระภายหลัง / เครดิตเทอม', 'เครดิตเทอม ภายหลัง ทีหลัง credit term later'],
    ['mdi:ticket-percent-outline', 'คูปอง / ส่วนลด', 'คูปอง ส่วนลด โปรโมชัน coupon discount'],
    ['mdi:gift-outline', 'บัตรของขวัญ', 'ของขวัญ บัตรกำนัล gift voucher'],
    ['mdi:bitcoin', 'สกุลเงินดิจิทัล', 'คริปโต บิทคอยน์ ดิจิทัล crypto bitcoin'],
    ['mdi:earth', 'ชำระจากต่างประเทศ', 'ต่างประเทศ ต่างชาติ international'],
    ['mdi:shield-check-outline', 'ชำระอย่างปลอดภัย', 'ปลอดภัย รับประกัน secure'],
    ['mdi:handshake-outline', 'ตามข้อตกลง / สัญญา', 'ข้อตกลง สัญญา ตกลง contract']
  ];
  const DEFAULT_ICON = ICONS[0][0];
  // คลังไอคอน Iconify ค้นได้เฉพาะภาษาอังกฤษ จึงแปลคำไทยที่ใช้บ่อยก่อนค้น
  const THAI_WORDS = {
    เงิน: 'money', ธนาคาร: 'bank', โอน: 'transfer', บัตร: 'credit-card', มือถือ: 'cellphone', โทรศัพท์: 'phone',
    กระเป๋า: 'wallet', วอลเล็ต: 'wallet', สแกน: 'qrcode', เช็ค: 'checkbook', ใบเสร็จ: 'receipt', ใบแจ้งหนี้: 'invoice',
    ปลายทาง: 'truck-delivery', ส่งของ: 'truck-delivery', ร้าน: 'store', คูปอง: 'ticket', ส่วนลด: 'sale', ผ่อน: 'calendar', งวด: 'calendar',
    ต่างประเทศ: 'earth', คริปโต: 'bitcoin', ดิจิทัล: 'bitcoin', ทอง: 'gold', ของขวัญ: 'gift', เวลา: 'clock',
    ปลอดภัย: 'shield', สัญญา: 'handshake', เอกสาร: 'file', ภาษี: 'file', ช่าง: 'hard-hat', แอร์: 'air-conditioner',
    บ้าน: 'home', รถ: 'car', ดาว: 'star', หัวใจ: 'heart'
  };
  const ICONIFY_SEARCH = 'https://api.iconify.design/search?prefix=mdi&limit=32&query=';
  let pickerCount = 0;

  function englishQuery(query) {
    if (/^[a-z0-9 -]+$/.test(query)) return query;
    const word = Object.keys(THAI_WORDS).find((w) => query.includes(w));
    return word ? THAI_WORDS[word] : '';
  }
  const iconTitle = (name) => name.replace(/^mdi:/, '').replace(/-/g, ' ');

  // เครื่องหมาย | ใช้แบ่งคอลัมน์ และขึ้นบรรทัดใหม่ใช้แบ่งรายการ จึงใส่ในข้อความไม่ได้
  const clean = (value) => value.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
  const parse = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('|').map((c) => c.trim()));

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {});
    (children || []).forEach((c) => node.append(c));
    return node;
  }

  function iconOf(name) {
    const icon = el('iconify-icon', { className: 'row-editor-icon' });
    icon.setAttribute('icon', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  // ช่องเลือกไอคอนแบบมีรูปในแต่ละตัวเลือก (เมนูของ <select> ใช้หน้าตาของระบบปฏิบัติการ แต่งสีหรือใส่รูปไม่ได้)
  // พิมพ์ค้นหาภาษาไทยเพื่อกรองรายการ ถ้าไม่เจอจะค้นต่อในคลังไอคอนชุดเดียวกัน ไม่ต้องออกไปหาจากเว็บอื่น
  function iconField(value, label) {
    const input = el('input', { type: 'hidden', value: value || DEFAULT_ICON });
    const listId = 'row-editor-icons-' + (++pickerCount);
    const current = iconOf(input.value);
    const currentText = el('span', { className: 'row-editor-iconname' });
    const button = el('button', { type: 'button', className: 'row-editor-iconbtn' },
      [current, currentText, el('span', { className: 'row-editor-iconcaret', textContent: '▾' })]);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', listId);
    const search = el('input', { type: 'search', className: 'row-editor-iconsearch', placeholder: 'ค้นหา เช่น ธนาคาร บัตร วอลเล็ต' });
    search.setAttribute('aria-label', 'ค้นหาไอคอน ' + label);
    search.setAttribute('aria-controls', listId);

    function option(v, text, extraClass, tag) {
      const item = el(tag || 'li', { className: 'row-editor-option' + extraClass, tabIndex: -1 }, [iconOf(v)].concat(text ? [el('span', { textContent: text })] : []));
      item.setAttribute('role', 'option');
      item.dataset.value = v;
      item.addEventListener('click', () => choose(v));
      return item;
    }
    const options = ICONS.map(([v, text, words]) => {
      const item = option(v, text, '');
      item.dataset.words = (text + ' ' + words).toLowerCase();
      return item;
    });
    const moreTitle = el('li', { className: 'row-editor-optgroup', textContent: 'ไอคอนเพิ่มเติมจากคลังไอคอน', hidden: true });
    const tiles = el('li', { className: 'row-editor-tiles', hidden: true });
    const status = el('li', { className: 'row-editor-status', hidden: true });
    [moreTitle, tiles, status].forEach((item) => item.setAttribute('role', 'presentation'));
    const list = el('ul', { className: 'row-editor-iconlist', id: listId }, options.concat([moreTitle, tiles, status]));
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label);
    const panel = el('div', { className: 'row-editor-iconpanel', hidden: true }, [search, list]);
    const wrap = el('div', { className: 'row-editor-iconpick' }, [button, panel]);
    let online = [];
    let searchTimer = 0;
    let searchRun = 0;

    const visible = () => options.filter((o) => !o.hidden).concat(online);
    function sync() {
      const known = ICONS.find(([v]) => v === input.value);
      current.setAttribute('icon', input.value);
      currentText.textContent = known ? known[1] : 'ไอคอนอื่น: ' + iconTitle(input.value);
      button.setAttribute('aria-label', label + ': ' + currentText.textContent);
      options.concat(online).forEach((o) => o.setAttribute('aria-selected', String(o.dataset.value === input.value)));
    }
    function showStatus(text) {
      status.textContent = text;
      status.hidden = !text;
    }
    function showOnline(names) {
      online = names.map((name) => {
        const tile = option(name, '', ' row-editor-tile', 'div'); // อยู่ในแถบไอคอน (li) จึงใช้ div
        tile.setAttribute('aria-label', iconTitle(name));
        tile.title = iconTitle(name);
        return tile;
      });
      tiles.replaceChildren(...online);
      tiles.hidden = !online.length;
      moreTitle.hidden = tiles.hidden;
      sync();
    }
    function searchLibrary(query) {
      const run = ++searchRun;
      const term = englishQuery(query);
      if (!term) {
        showOnline([]);
        showStatus(visible().length ? '' : 'ไม่พบในรายการ ลองพิมพ์ภาษาอังกฤษเพื่อค้นในคลังไอคอน เช่น wallet, gift');
        return;
      }
      showStatus('กำลังค้นหาในคลังไอคอน…');
      fetch(ICONIFY_SEARCH + encodeURIComponent(term))
        .then((r) => r.json())
        .then((data) => {
          if (run !== searchRun) return;
          showOnline((data.icons || []).filter((n) => !ICONS.some(([v]) => v === n)).slice(0, 24));
          showStatus(visible().length ? '' : 'ไม่พบไอคอนที่ตรงกับคำค้น ลองคำอื่น');
        })
        .catch(() => { if (run === searchRun) showStatus('ค้นหาในคลังไอคอนไม่ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'); });
    }
    function filter() {
      const query = search.value.trim().toLowerCase();
      options.forEach((o) => { o.hidden = !!query && !o.dataset.words.includes(query); });
      clearTimeout(searchTimer);
      showOnline([]);
      showStatus('');
      if (query.length >= 2) searchTimer = setTimeout(() => searchLibrary(query), 300);
    }
    function set(v) {
      input.value = v;
      sync();
      input.dispatchEvent(new Event('change'));
    }
    function outside(e) {
      if (!wrap.contains(e.target)) close(false);
    }
    function open() {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      search.value = '';
      filter();
      search.focus();
      document.addEventListener('pointerdown', outside);
    }
    function close(refocus) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      clearTimeout(searchTimer);
      document.removeEventListener('pointerdown', outside);
      if (refocus) button.focus();
    }
    function choose(v) {
      set(v);
      close(true);
    }
    function focusAt(index) {
      const items = visible();
      if (index < 0) search.focus();
      else if (items.length) items[Math.min(index, items.length - 1)].focus();
    }
    const listKeys = {
      ArrowDown: (i) => focusAt(i + 1),
      ArrowRight: (i) => focusAt(i + 1),
      ArrowUp: (i) => focusAt(i - 1),
      ArrowLeft: (i) => focusAt(i - 1),
      Home: () => focusAt(0),
      End: () => focusAt(visible().length - 1),
      Enter: (i) => choose(visible()[i].dataset.value),
      ' ': (i) => choose(visible()[i].dataset.value)
    };
    list.addEventListener('keydown', (e) => {
      if (!listKeys[e.key]) return;
      e.preventDefault();
      listKeys[e.key](Math.max(0, visible().indexOf(document.activeElement)));
    });
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(0); }
      if (e.key === 'Enter') { // ไม่ให้ Enter ในช่องค้นหาส่งฟอร์ม ให้เลือกตัวแรกที่เจอแทน
        e.preventDefault();
        if (visible().length) choose(visible()[0].dataset.value);
      }
    });
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      if (e.key === 'Tab') close(false);
    });
    button.addEventListener('click', () => (panel.hidden ? open() : close(true)));
    button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    sync();
    return { input, node: wrap };
  }

  function textField(column, value, label) {
    const input = column.wide ? el('textarea', { rows: 2 }) : el('input', { type: 'text' });
    input.value = value || '';
    input.setAttribute('aria-label', label);
    if (column.placeholder) input.placeholder = column.placeholder;
    return { input, node: input };
  }

  function setup(textarea) {
    const config = JSON.parse(textarea.dataset.rowEditor);
    const columns = config.columns;
    const firstColumn = config.autoNumber ? 1 : 0; // คอลัมน์แรกเป็นเลขลำดับที่ระบบใส่ให้
    const rows = parse(textarea.value).map((cells) => cells.slice(firstColumn));
    const expanded = new Set(); // รายการที่กางอยู่ (เริ่มต้นย่อทุกรายการ ให้เห็นภาพรวมก่อน)
    const list = el('div', { className: 'row-editor-list' });
    const addButton = el('button', { type: 'button', className: 'btn ln row-editor-add', textContent: '+ ' + config.addLabel });
    const expandAll = el('button', { type: 'button', className: 'mini row-editor-expand', textContent: 'ขยายทั้งหมด' });
    const collapseAll = el('button', { type: 'button', className: 'mini row-editor-expand', textContent: 'ย่อทั้งหมด' });
    const toolbar = el('div', { className: 'row-editor-toolbar' }, [expandAll, collapseAll]);
    const editor = el('div', { className: 'row-editor' }, [toolbar, list, addButton]);

    function serialize() {
      textarea.value = rows
        .map((cells) => columns.map((_, i) => clean(cells[i] || '')))
        .filter((cells) => cells.some(Boolean))
        .map((cells, i) => (config.autoNumber ? [String(i + 1).padStart(2, '0')].concat(cells) : cells).join(' | '))
        .join('\n');
    }

    // ข้อความสรุปบนแถวที่ย่ออยู่ เช่น "โอนผ่านธนาคาร · ธนาคารกสิกรไทย…"
    function summaryText(cells) {
      const parts = columns
        .map((c, i) => (c.type === 'icon' ? '' : clean(cells[i] || '')))
        .filter(Boolean)
        .map((v) => (v.length > 60 ? v.slice(0, 60) + '…' : v));
      return parts.join(' · ') || 'ยังไม่ได้กรอกข้อมูล';
    }

    function move(index, delta) {
      const dest = index + delta;
      [rows[index], rows[dest]] = [rows[dest], rows[index]];
      render();
    }

    function setOpen(cells, toggle, box, open) {
      if (open) expanded.add(cells); else expanded.delete(cells);
      box.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.firstChild.textContent = open ? '▾' : '▸';
    }

    function card(cells, index) {
      const title = config.itemLabel + ' ' + (index + 1);
      const summary = el('span', { className: 'row-editor-summary', textContent: summaryText(cells) });
      const iconAt = columns.findIndex((c) => c.type === 'icon');
      const summaryIcon = iconAt >= 0 ? el('iconify-icon', { className: 'row-editor-icon' }) : null;
      if (summaryIcon) summaryIcon.setAttribute('icon', cells[iconAt] || DEFAULT_ICON);
      const fields = columns.map((column, i) => {
        const label = column.label + ' ' + config.itemLabel + 'ที่ ' + (index + 1);
        const field = column.type === 'icon' ? iconField(cells[i], label) : textField(column, cells[i], label);
        const update = () => {
          cells[i] = field.input.value;
          serialize();
          summary.textContent = summaryText(cells);
          if (i === iconAt) summaryIcon.setAttribute('icon', field.input.value);
        };
        field.input.addEventListener('input', update);
        field.input.addEventListener('change', update);
        // ช่องเลือกไอคอนมีปุ่มหลายตัวข้างใน จึงห่อด้วย div แทน label
        return el(column.type === 'icon' ? 'div' : 'label', { className: 'row-editor-field' + (column.wide ? ' wide' : '') }, [el('span', { textContent: column.label }), field.node]);
      });
      const box = el('div', { className: 'row-editor-fields', id: textarea.id + '-row-' + (index + 1) }, fields);
      const toggle = el('button', { type: 'button', className: 'row-editor-toggle' },
        [el('span', { className: 'row-editor-caret' }), el('strong', { textContent: title })].concat(summaryIcon ? [summaryIcon] : [], [summary]));
      toggle.setAttribute('aria-controls', box.id);
      toggle.addEventListener('click', () => setOpen(cells, toggle, box, box.hidden));
      setOpen(cells, toggle, box, expanded.has(cells));
      const actions = [
        ['↑', 'เลื่อนขึ้น', index === 0, () => move(index, -1)],
        ['↓', 'เลื่อนลง', index === rows.length - 1, () => move(index, 1)],
        ['ลบ', 'ลบ', false, () => { rows.splice(index, 1); render(); }]
      ].map(([text, name, disabled, onClick]) => {
        const button = el('button', { type: 'button', className: 'mini row-editor-' + (text === 'ลบ' ? 'remove' : 'move'), textContent: text, disabled });
        button.setAttribute('aria-label', name + ' ' + title);
        button.addEventListener('click', onClick);
        return button;
      });
      const head = el('div', { className: 'row-editor-head' }, [toggle, el('div', { className: 'row-editor-actions' }, actions)]);
      return el('div', { className: 'row-editor-card' }, [head, box]);
    }

    function render() {
      list.replaceChildren(...rows.map(card));
      if (!rows.length) list.append(el('p', { className: 'hint', textContent: 'ยังไม่มีรายการ กด "' + config.addLabel + '" เพื่อเพิ่ม' }));
      toolbar.hidden = rows.length < 2;
      serialize();
    }

    expandAll.addEventListener('click', () => { rows.forEach((cells) => expanded.add(cells)); render(); });
    collapseAll.addEventListener('click', () => { expanded.clear(); render(); });
    addButton.addEventListener('click', () => {
      const cells = columns.map((c) => (c.type === 'icon' ? DEFAULT_ICON : ''));
      rows.push(cells);
      expanded.add(cells); // รายการใหม่กางไว้ให้กรอกได้ทันที
      render();
      list.lastElementChild.querySelector('input, textarea, select').focus();
    });

    textarea.hidden = true;
    textarea.after(editor);
    const fld = textarea.closest('.fld');
    fld?.querySelectorAll('[data-raw-hint]').forEach((hint) => { hint.hidden = true; });
    render();
  }

  document.querySelectorAll('textarea[data-row-editor]').forEach(setup);
})();
