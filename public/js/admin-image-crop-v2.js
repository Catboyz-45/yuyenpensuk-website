/* Yuyenpensuk staging: crop selected local images only. Does not modify saved images. */
(() => {
  'use strict';
  const form = document.querySelector('form[action="/admin/products/save"]');
  if (!form) return;
  const main = form.querySelector('input[type="file"][name="image"]');
  const gallery = form.querySelector('input[type="file"][name="gallery"]');
  if (!main || !gallery || !window.DataTransfer) return;
  const style = document.createElement('style');
  style.textContent = `.yy-crop-dialog{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}.yy-crop-panel{background:#fff;color:#17352a;border-radius:16px;width:min(94vw,660px);max-height:94vh;overflow:auto;padding:20px;box-shadow:0 15px 60px #0005}.yy-crop-frame{width:min(100%,440px);aspect-ratio:1;margin:12px auto;overflow:hidden;touch-action:none;background:#eee;border:2px solid #2e7d32;position:relative;cursor:grab}.yy-crop-frame img{position:absolute;max-width:none;user-select:none;pointer-events:none}.yy-crop-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}.yy-crop-actions button,.yy-crop-launch{padding:9px 14px;border-radius:8px;border:1px solid #2e7d32;background:#fff;color:#20572b;cursor:pointer}.yy-crop-actions .yy-primary{background:#2e7d32;color:white}.yy-crop-panel label{display:block;margin-top:12px}.yy-crop-panel input[type=range]{width:100%}`;
  document.head.appendChild(style);
  function launchButton(input, label) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'yy-crop-launch'; btn.textContent = label;
    input.after(btn);
    btn.addEventListener('click', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) { alert('กรุณาเลือกรูปภาพก่อน'); return; }
      let index = 0;
      if (input === gallery && files.length > 1) {
        const chosen = prompt('เลือกหมายเลขรูปที่ต้องการ Crop (1-' + files.length + ')', '1');
        if (chosen === null) return;
        index = Number(chosen) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= files.length) { alert('หมายเลขรูปไม่ถูกต้อง'); return; }
      }
      try {
        const output = await editImage(files[index]);
        if (!output) return;
        files[index] = output;
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles:true}));
      } catch (err) { alert('ไม่สามารถปรับรูปได้: ' + (err.message || err)); }
    });
  }
  async function editImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ');
    const url = URL.createObjectURL(file);
    let image;
    try {
      image = new Image(); image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('อ่านไฟล์ภาพไม่ได้');
      if (image.naturalWidth * image.naturalHeight > 60000000) throw new Error('รูปภาพมีขนาดใหญ่เกินไป');
      return await showEditor(image, file);
    } finally { URL.revokeObjectURL(url); }
  }
  function showEditor(image, file) {
    return new Promise(resolve => {
      const modal = document.createElement('div'); modal.className = 'yy-crop-dialog';
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `<div class="yy-crop-panel"><h3>ปรับรูปก่อนอัปโหลด (1:1)</h3><p>ลากรูปในกรอบเพื่อเลื่อนตำแหน่ง และปรับซูมได้ รูปต้นฉบับบนเครื่องไม่ถูกเปลี่ยน</p><div class="yy-crop-frame"><img alt="ภาพสำหรับปรับตำแหน่ง" draggable="false"></div><label>ซูมภาพ <output>100%</output><input type="range" min="100" max="300" step="5" value="100"></label><div class="yy-crop-actions"><button type="button" data-action="reset">คืนค่าภาพเดิม</button><button type="button" data-action="preview">ดูตัวอย่าง</button><button type="button" data-action="cancel">ยกเลิก</button><button type="button" class="yy-primary" data-action="save">ใช้ภาพที่ปรับ</button></div></div>`;
      document.body.appendChild(modal);
      const frame = modal.querySelector('.yy-crop-frame'), img = modal.querySelector('img');
      const range = modal.querySelector('input[type=range]'), out = modal.querySelector('output');
      img.src = image.src;
      let scale = 1, dx = 0, dy = 0, dragging = null;
      function clamp() {
        const side = frame.clientWidth;
        const s = (side / Math.min(image.naturalWidth, image.naturalHeight)) * scale, w = image.naturalWidth * s, h = image.naturalHeight * s;
        dx = Math.max(side-w, Math.min(0, dx)); dy = Math.max(side-h, Math.min(0, dy));
      }
      function update() {
        clamp(); const s = (frame.clientWidth / Math.min(image.naturalWidth, image.naturalHeight)) * scale;
        img.style.width = image.naturalWidth*s + 'px'; img.style.height = image.naturalHeight*s + 'px';
        img.style.left = dx + 'px'; img.style.top = dy + 'px'; out.textContent = Math.round(scale*100) + '%';
      }
      function center() { const s=(frame.clientWidth / Math.min(image.naturalWidth, image.naturalHeight))*scale; dx=(frame.clientWidth-image.naturalWidth*s)/2; dy=(frame.clientWidth-image.naturalHeight*s)/2; update(); }
      center();
      range.addEventListener('input', () => {
        const side=frame.clientWidth;
        const oldW=image.naturalWidth*(side/Math.min(image.naturalWidth,image.naturalHeight))*scale;
        const oldH=image.naturalHeight*(side/Math.min(image.naturalWidth,image.naturalHeight))*scale;
        const cx=(side/2-dx)/oldW, cy=(side/2-dy)/oldH;
        scale=Number(range.value)/100;
        const newW=image.naturalWidth*(side/Math.min(image.naturalWidth,image.naturalHeight))*scale;
        const newH=image.naturalHeight*(side/Math.min(image.naturalWidth,image.naturalHeight))*scale;
        dx=side/2-cx*newW; dy=side/2-cy*newH; update();
      });
      frame.addEventListener('pointerdown', e => { dragging = {id:e.pointerId,x:e.clientX,y:e.clientY}; frame.setPointerCapture(e.pointerId); });
      frame.addEventListener('pointermove', e => {
        if (dragging?.id !== e.pointerId) return;
        dx += e.clientX - dragging.x;
        dy += e.clientY - dragging.y;
        dragging.x = e.clientX;
        dragging.y = e.clientY;
        update();
      });
      frame.addEventListener('pointerup', () => dragging=null);
      frame.addEventListener('pointercancel', () => dragging=null);
      // Keep the same image point at the frame centre when its dimensions change.
      // Calling center() on every resize discarded the user's crop position.
      let lastSide = frame.clientWidth;
      const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
        const nextSide = frame.clientWidth;
        if (!nextSide || !lastSide || Math.abs(nextSide - lastSide) < 0.5) return;
        const factor = nextSide / lastSide;
        dx *= factor;
        dy *= factor;
        lastSide = nextSide;
        update();
      }) : null;
      if (observer) observer.observe(frame);
      function canvas() {
        const c=document.createElement('canvas'); c.width=1200;c.height=1200;
        const ctx=c.getContext('2d');
        if (!frame.clientWidth) throw new Error('กรอบภาพมีขนาดไม่ถูกต้อง');
        const ratio=c.width/frame.clientWidth;
        const currentBase = frame.clientWidth / Math.min(image.naturalWidth, image.naturalHeight);
        ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
        ctx.drawImage(image,dx*ratio,dy*ratio,image.naturalWidth*currentBase*scale*ratio,image.naturalHeight*currentBase*scale*ratio);
        return c;
      }
      const escape = e => { if (e.key==='Escape') finish(null); };
      let finished=false;
      function finish(value) {
        if (finished) return;
        finished = true;
        if (observer) observer.disconnect();
        document.removeEventListener('keydown', escape);
        modal.remove();
        resolve(value);
      }
      document.addEventListener('keydown',escape);
      modal.addEventListener('click', e => {
        const action=e.target.closest('button[data-action]')?.dataset.action;
        if (!action) return;
        if (action==='cancel') finish(null);
        if (action==='reset') { scale=1;range.value='100';center(); }
        if (action==='preview') { const win=window.open('','_blank'); if(win) {win.document.title='ตัวอย่างภาพที่ Crop';const im=win.document.createElement('img');im.src=canvas().toDataURL('image/jpeg',.88);im.style.cssText='max-width:90vw;max-height:90vh;object-fit:contain';win.document.body.appendChild(im);} else alert('เบราว์เซอร์บล็อกหน้าต่างตัวอย่าง'); }
        if (action==='save') {
          const saveButton = modal.querySelector('[data-action=save]');
          saveButton.disabled = true;
          try {
            canvas().toBlob(blob => {
              if (finished) return;
              if (!blob) { saveButton.disabled = false; alert('สร้างไฟล์ภาพไม่สำเร็จ'); return; }
              const name=file.name.replace(/\.[^.]+$/,'')+'-crop.jpg';
              finish(new File([blob],name,{type:'image/jpeg',lastModified:Date.now()}));
            }, 'image/jpeg', .9);
          } catch (err) {
            saveButton.disabled = false;
            alert('ไม่สามารถสร้างรูปภาพได้: ' + (err.message || err));
          }
        }
      });
    });
  }
  // Edit an already saved cover by fetching its same-origin public image, then
  // attaching the cropped result as a NEW upload. Original is not mutated.
  const savedUrl = main.dataset.savedImage;
  if (savedUrl) {
    const savedButton = document.createElement('button');
    savedButton.type = 'button';
    savedButton.className = 'yy-crop-launch';
    savedButton.textContent = 'Crop รูปหน้าปกที่บันทึกไว้';
    main.after(savedButton);
    savedButton.addEventListener('click', async () => {
      savedButton.disabled = true;
      try {
        const parsed = new URL(savedUrl, location.origin);
        if (parsed.origin !== location.origin || !parsed.pathname.startsWith('/uploads/'))
          throw new Error('รูปเดิมไม่ใช่ไฟล์อัปโหลดของเว็บไซต์');
        const response = await fetch(parsed.href, {credentials:'same-origin'});
        if (!response.ok) throw new Error('โหลดรูปเดิมไม่ได้ (' + response.status + ')');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('ไฟล์เดิมไม่ใช่รูปภาพ');
        const original = new File([blob], 'saved-cover.jpg', {type:blob.type});
        const result = await editImage(original);
        if (result) {
          const transfer = new DataTransfer();
          transfer.items.add(result);
          main.files = transfer.files;
          main.dispatchEvent(new Event('change', {bubbles:true}));
        }
      } catch (error) { alert('Crop รูปเดิมไม่ได้: ' + (error.message || error)); }
      finally { savedButton.disabled = false; }
    });
  }
  launchButton(main,'ปรับรูปหลักก่อนอัปโหลด');
  launchButton(gallery,'ปรับรูปแกลเลอรีที่เลือก');
})();
