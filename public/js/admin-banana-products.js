(function(){'use strict';
const params=new URLSearchParams(location.search), editor=document.querySelector('.banana-editor'),list=document.getElementById('banana-list-view');
if(!editor||!list)return;
const showEditor=params.has('add')||params.has('edit')||location.hash==='#add-form';
const selectedBrand=params.get('brand')||'';const grid=document.getElementById('banana-brand-grid'),products=document.getElementById('banana-brand-products');
if(grid&&products){grid.hidden=!!selectedBrand;products.hidden=!selectedBrand;const h=document.getElementById('banana-selected-title'),add=document.getElementById('banana-brand-add');if(h)h.textContent=selectedBrand;if(add)add.href='/admin/products?add=1&brand='+encodeURIComponent(selectedBrand);}

editor.hidden=!showEditor;list.hidden=showEditor;
const toolbar=document.querySelector('.banana-toolbar');if(toolbar&&showEditor){const h=toolbar.querySelector('h2');if(h)h.textContent=params.has('edit')?'แก้ไขสินค้า':'เพิ่มสินค้าใหม่';}
const search=document.getElementById('banana-search'),brand=document.getElementById('banana-brand-filter'),rows=[...document.querySelectorAll('[data-banana-product]')],count=document.getElementById('banana-count'),empty=document.getElementById('banana-empty');
function filter(){let n=0;rows.forEach(row=>{const ok=(!search.value||row.dataset.search.includes(search.value.trim().toLowerCase()))&&(!brand.value||row.dataset.brand===brand.value);row.hidden=!ok;if(ok)n++;});count.textContent=n+' รายการ';empty.hidden=n!==0;}
if(search&&brand){const selected=params.get('brand');if(selected)brand.value=selected;filter();search.addEventListener('input',filter);brand.addEventListener('change',filter);}
const tabs=[...document.querySelectorAll('.banana-tab')],sections=[...document.querySelectorAll('[data-section]')];
function selectTab(name){tabs.forEach(t=>{const active=t.dataset.tab===name;t.classList.toggle('is-active',active);t.setAttribute('aria-selected',String(active));});sections.forEach(s=>s.hidden=s.dataset.section!==name);}
tabs.forEach(t=>t.addEventListener('click',()=>selectTab(t.dataset.tab)));selectTab('basic');
const form=document.querySelector('.banana-edit-form');if(form)form.addEventListener('submit',function(e){const invalid=form.querySelector(':invalid');if(invalid){const section=invalid.closest('[data-section]');if(section)selectTab(section.dataset.section);invalid.focus();e.preventDefault();}});
})();
