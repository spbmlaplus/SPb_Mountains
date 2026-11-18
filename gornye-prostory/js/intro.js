/* Обложка: облака над спутником → приветствие → выбор «Исследователь / Читатель». Потом облака уходят насовсем.
   Показывается, только когда сайт открыт на главной (#/ или без адреса).
   Кнопки работают даже если карта не загрузилась: всё, что касается карты, обёрнуто в try. */
(function(){
  'use strict';
  const body = document.body, $ = id => document.getElementById(id);
  const safe = fn => { try{ fn(); }catch(e){ console.warn('[обложка]', e); } };
  const map = () => window.GPMap;
  const clouds = () => window.GPClouds || {setClear(){}};
  const INTRO = {center:[30.32, 59.93], zoom:8.4, pitch:0, bearing:0};
  const HANDLERS = ['scrollZoom','boxZoom','dragRotate','dragPan','keyboard','doubleClickZoom','touchZoomRotate'];
  const lock = on => safe(() => HANDLERS.forEach(h => map()[h] && map()[h][on ? 'disable' : 'enable']()));
  let spin = true;

  function enter(){
    if(!$('coverWelcome').hidden) return;
    $('coverTitle').hidden = true; $('coverWelcome').hidden = false; body.classList.add('welcome');
    spin = false;
    safe(() => clouds().setClear(.45));
    safe(() => { map().stop(); map().flyTo({center:[30.30, 59.90], zoom:9.1, pitch:0, bearing:0, duration:4200, essential:true}); });
    setTimeout(() => { spin = true; }, 4300);
  }
  function finish(go){
    if(!body.classList.contains('intro')) return;
    spin = false; lock(false);
    body.classList.add('clouds-going'); body.classList.remove('intro', 'welcome');
    safe(() => clouds().setClear(1));
    safe(() => map().stop());
    setTimeout(() => body.classList.add('clouds-gone'), 1700);
    requestAnimationFrame(() => safe(() => map().resize()));
    if(go !== undefined){
      if(location.hash === go || (go === '#/' && !location.hash)) window.dispatchEvent(new Event('hashchange'));
      else location.hash = go;
    }
  }

  // клики ловим делегированием — так кнопки не зависят от порядка загрузки скриптов
  document.addEventListener('click', e => {
    if(!body.classList.contains('intro')) return;
    if(e.target.closest('#coverEnter')){ e.preventDefault(); enter(); return; }
    const g = e.target.closest('#coverWelcome [data-go]');
    if(g){ e.preventDefault(); finish(g.dataset.go); }
  });
  addEventListener('keydown', e => { if(e.key === 'Escape' && body.classList.contains('intro')) finish('#/'); });
  addEventListener('hashchange', () => { if(body.classList.contains('intro') && location.hash.replace(/^#\/?/, '')) finish(); });

  if(location.hash.replace(/^#\/?/, '')){ body.classList.remove('intro'); body.classList.add('clouds-gone'); return; }

  lock(true);
  safe(() => clouds().setClear(0));
  safe(() => map().jumpTo(INTRO));
  function rotate(){ if(!spin || !body.classList.contains('intro')) return;
    safe(() => map().easeTo({bearing:map().getBearing() + 6, duration:12000, easing:t => t})); }
  // карта сначала всегда прямо, без вращения

})();
