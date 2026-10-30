// GPT Auto Mobile v0.1.1 — experimental, local-only.
(function () {
  'use strict';
  if (window.top !== window || location.hostname !== 'chatgpt.com') return;
  if (window.__gptAutoMobile) { window.__gptAutoMobile.attach(); return; }
  var maxRounds = 10, rounds = 0, enabled = false, seenBusy = false;
  var lastText = '', stableAt = Date.now(), lastSent = 0, sending = false;
  var currentPath = location.pathname, host = null, status = 'متوقف';
  function one(q) { try { return document.querySelector(q); } catch (_) { return null; } }
  function visible(el) { return !!(el && el.getClientRects && el.getClientRects().length); }
  function conversation() { return /^\/c\/[a-zA-Z0-9_-]+/.test(location.pathname); }
  function busy() {
    var b = one('[data-testid="stop-button"]') || one('button[aria-label="Stop generating"]');
    return visible(b);
  }
  function answer() {
    var nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
    return nodes.length ? (nodes[nodes.length - 1].innerText || '').trim() : '';
  }
  function box() {
    return one('#prompt-textarea') || one('div[contenteditable="true"][role="textbox"]') || one('textarea[placeholder]');
  }
  function boxText(el) { return el ? (el.isContentEditable ? el.innerText : el.value || '').trim() : ''; }
  function update() {
    var s = host && host.querySelector('#gam-status');
    var b = host && host.querySelector('#gam-toggle');
    if (s) s.textContent = status + ' (' + rounds + '/' + maxRounds + ')';
    if (b) { b.textContent = enabled ? 'إيقاف' : 'تشغيل'; b.setAttribute('aria-pressed', enabled ? 'true' : 'false'); }
  }
  function stop(reason) {
    enabled = false; sending = false; seenBusy = false; rounds = 0;
    lastSent = 0; lastText = ''; stableAt = Date.now();
    status = reason || 'متوقف'; update();
  }
  function attach() {
    if (!document.body || document.getElementById('gam-panel')) return;
    host = document.createElement('div');
    host.id = 'gam-panel';
    host.dir = 'rtl';
    host.style.cssText = 'position:fixed;right:10px;bottom:85px;z-index:2147483646;max-width:calc(100vw - 20px);background:#102333;color:white;border:1px solid #008b80;border-radius:12px;padding:11px;font:13px sans-serif;box-shadow:0 5px 18px #0007;';
    var title = document.createElement('div');
    title.textContent = 'GPT Auto Mobile';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px';
    var toggle = document.createElement('button');
    toggle.id = 'gam-toggle';
    toggle.type = 'button';
    toggle.style.cssText = 'background:#088f83;color:white;border:0;border-radius:7px;padding:7px 14px';
    toggle.textContent = 'تشغيل';
    var input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.max = '50'; input.value = String(maxRounds);
    input.style.cssText = 'width:43px;margin:0 7px;padding:4px;color:#111;border-radius:4px';
    var label = document.createElement('span');
    label.textContent = 'الجولات';
    var stat = document.createElement('div');
    stat.id = 'gam-status';
    stat.style.cssText = 'font-size:11px;margin-top:8px';
    stat.textContent = status;
    var collapse = document.createElement('button');
    collapse.textContent = '−'; collapse.type='button';
    collapse.style.cssText='margin-right:7px;border:0;border-radius:5px;padding:4px 8px';
    var content = document.createElement('div');
    content.append(toggle, label, input, stat);
    host.append(title, collapse, content);
    collapse.addEventListener('click', function () {
      content.style.display = content.style.display === 'none' ? '' : 'none';
      collapse.textContent = content.style.display === 'none' ? '+' : '−';
    });
    toggle.addEventListener('click', function () {
      if (enabled) { stop('أوقفته يدويًا'); return; }
      if (!conversation()) { status='افتح محادثة موجودة أولًا'; update(); return; }
      enabled = true; rounds = 0; seenBusy = false; lastSent = 0;
      lastText = answer(); stableAt = Date.now();
      status='ينتظر توليد رد جديد'; update();
    });
    input.addEventListener('change', function () {
      maxRounds = Math.max(1, Math.min(50, parseInt(input.value, 10) || 10));
      input.value = String(maxRounds); update();
    });
    document.body.appendChild(host);
    update();
  }
  async function continueChat() {
    if (!enabled || sending || !conversation() || document.hidden) return;
    if (rounds >= maxRounds) { stop('وصل الحد الأقصى'); return; }
    var el = box();
    if (!visible(el) || boxText(el)) { stop('المربع غير متاح أو يحتوي نصًا'); return; }
    sending = true; status = 'إرسال متابعة'; update();
    var text = 'تابع من آخر نقطة دون تكرار. إذا كانت المهمة مكتملة، وضح ذلك ولا تبدأ مهمة جديدة.';
    try {
      el.focus();
      if (el.isContentEditable) {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el); range.collapse(false);
        sel.removeAllRanges(); sel.addRange(range);
        if (!document.execCommand('insertText', false, text)) throw Error('insert failed');
      } else {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
        el.dispatchEvent(new Event('input', {bubbles:true}));
      }
      await new Promise(function (done) { setTimeout(done, 320); });
      if (!enabled || document.hidden || boxText(el) !== text) throw Error('input not accepted');
      var send = one('[data-testid="send-button"]') || one('button[aria-label="Send prompt"]');
      if (!visible(send) || send.disabled) throw Error('send unavailable');
      send.click();
      rounds++; lastSent=Date.now(); seenBusy=false;
      status='انتظار الرد'; update();
    } catch (_) {
      stop('فشل الإرسال؛ تم الإيقاف');
    } finally { sending = false; }
  }
  function tick() {
    try {
      if (location.pathname !== currentPath) { currentPath=location.pathname; stop('انتقلت لمحادثة أخرى'); }
      attach();
      if (!enabled || sending || document.hidden || !conversation()) return;
      if (busy()) { seenBusy=true; stableAt=Date.now(); status='يولد ردًا'; update(); return; }
      var text = answer();
      if (text && text !== lastText) { lastText=text; stableAt=Date.now(); }
      if (!seenBusy || !text) return;
      if (Date.now()-stableAt < 4000 || (lastSent && Date.now()-lastSent < 6000)) return;
      seenBusy=false; void continueChat();
    } catch (_) { stop('خطأ في الواجهة؛ تم الإيقاف'); }
  }
  window.__gptAutoMobile = { attach:attach, stop:stop };
  attach();
  setInterval(tick, 800);
})();