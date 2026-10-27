// admin-product-thumbs.js — โหลดรูปตัวอย่างสินค้าในตารางและในฟอร์มแก้ไข (แยกจากหน้า EJS เพราะ CSP ไม่อนุญาตสคริปต์ในหน้า)
(function(){
  function setThumb(el, urls){
    el.innerHTML = '';
    var img = document.createElement('img');
    var i = 0;
    img.loading = 'lazy'; img.alt = 'รูปสินค้า';
    img.onerror = function(){
      i += 1;
      if (i < urls.length) img.src = urls[i];
      else el.innerHTML = '<iconify-icon icon="mdi:air-conditioner"></iconify-icon>';
    };
    el.appendChild(img);
    img.src = urls[0];
  }
  document.querySelectorAll('.admin-prod-thumb[data-product-id]').forEach(function(el){
    fetch('/admin/api/product-gallery/' + encodeURIComponent(el.dataset.productId))
      .then(function(r){ return r.json(); })
      .then(function(d){ if(d.images?.length) setThumb(el, d.images.slice(0,5)); })
      .catch(function(){});
  });
  var box = document.querySelector('.admin-remote-gallery[data-product-id]');
  if(box){
    fetch('/admin/api/product-gallery/' + encodeURIComponent(box.dataset.productId))
      .then(function(r){ return r.json(); })
      .then(function(d){
        box.innerHTML = '';
        (d.images || []).forEach(function(url, i){
          var span=document.createElement('span'); span.className='thumb'; span.style.cssText='width:90px;height:70px;background:#fff';
          var img=document.createElement('img'); img.src=url; img.loading='lazy'; img.alt='รูปสินค้าจริง '+(i+1);
          img.onerror=function(){span.remove();}; span.appendChild(img); box.appendChild(span);
        });
        if(!d.images?.length) box.innerHTML='<span class="hint">ไม่พบรูปจากหน้าสินค้าของรุ่นนี้</span>';
      })
      .catch(function(){ box.innerHTML='<span class="hint">โหลดรูปไม่สำเร็จ</span>'; });
  }
})();
