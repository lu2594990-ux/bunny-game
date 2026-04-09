jQuery(() => {
    document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');

    function getPresetName() {
        try {
            var el = document.getElementById("settings_preset_openai");
            if (el && el.value) return el.value;
            el = document.getElementById("settings_preset");
            if (el && el.value) return el.value;
        } catch (e) {}
        return "default";
    }
    function getGroupKey() { return "bunnyPG_" + getPresetName(); }
    function loadGroups() { try { return JSON.parse(localStorage.getItem(getGroupKey())) || []; } catch (e) { return []; } }
    function saveGroups(g) { localStorage.setItem(getGroupKey(), JSON.stringify(g)); }
    function loadHistory() { try { return JSON.parse(localStorage.getItem("bnySearchHist")) || []; } catch (e) { return []; } }
    function saveHistory(a) { localStorage.setItem("bnySearchHist", JSON.stringify(a)); }
    function addHistory(q) {
        var arr = loadHistory();
        arr = arr.filter(function (x) { return x !== q; });
        arr.unshift(q);
        if (arr.length > 10) arr = arr.slice(0, 10);
        saveHistory(arr);
    }
    function loadCmdData() { try { return JSON.parse(localStorage.getItem("bnyCmdData")) || []; } catch (e) { return []; } }
    function saveCmdData(d) { localStorage.setItem("bnyCmdData", JSON.stringify(d)); }
    function loadSkinData() {
        try {
            var d = JSON.parse(localStorage.getItem("bnySkinData"));
            if (d && d.skins) return d;
        } catch (e) {}
        return { skins: [], activeIndex: -1, size: 52, shape: "none", moods: [], moodMode: "off" };
    }
    function saveSkinData(d) { localStorage.setItem("bnySkinData", JSON.stringify(d)); }
    function replaceVars(text) {
        try {
            var ctx = SillyTavern.getContext();
            text = text.replace(/\{\{user\}\}/gi, ctx.name1 || "User");
            text = text.replace(/\{\{char\}\}/gi, ctx.name2 || "Char");
        } catch (e) {}
        var now = new Date();
        text = text.replace(/\{\{date\}\}/gi, now.toLocaleDateString());
        text = text.replace(/\{\{time\}\}/gi, now.toLocaleTimeString());
        return text;
    }
    function sendToInput(text, autoSend) {
        text = replaceVars(text);
        var ta = document.getElementById("send_textarea");
        if (!ta) return;
        ta.value = text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
        if (autoSend) {
            setTimeout(function () {
                var btn = document.getElementById("send_but");
                if (btn) btn.click();
            }, 100);
        }
    }

    $(document.getElementById("extensions_settings")).append(
        '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
        '<b>🐰 Bunny Toolbox</b>' +
        '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">' +
        '<input type="checkbox" id="bny-toggle" /><span>Show Bunny</span>' +
        '</label>' +
        '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
        '</div></div>'
    );

    var engines = {
        google: { name: "Google", search: function (q) { return "https://www.google.com/search?igu=1&q=" + encodeURIComponent(q); }, fallback: function (q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); } },
        baidu: { name: "百度", search: function (q) { return "https://www.baidu.com/s?wd=" + encodeURIComponent(q); }, fallback: function (q) { return "https://www.baidu.com/s?wd=" + encodeURIComponent(q); } },
        bing: { name: "必应", search: function (q) { return "https://www.bing.com/search?q=" + encodeURIComponent(q); }, fallback: function (q) { return "https://www.bing.com/search?q=" + encodeURIComponent(q); } },
        quark: { name: "夸克", search: function (q) { return "https://quark.sm.cn/s?q=" + encodeURIComponent(q); }, fallback: function (q) { return "https://quark.sm.cn/s?q=" + encodeURIComponent(q); } }
    };
    var engineKeys = ["google", "baidu", "bing", "quark"];
    function getEngine() { var k = localStorage.getItem("bnyEngine") || "google"; return engines[k] || engines.google; }
    function setEngine(k) { localStorage.setItem("bnyEngine", k); }

    function getActiveOrder() {
        try {
            var ccs = SillyTavern.getContext().chatCompletionSettings;
            if (!ccs || !ccs.prompt_order) return [];
            var po = ccs.prompt_order;
            var best = po[0];
            for (var i = 1; i < po.length; i++) {
                if (po[i].order && po[i].order.length > best.order.length) best = po[i];
            }
            return best.order || [];
        } catch (e) { return []; }
    }
    function getPromptById(id) {
        try {
            var prompts = SillyTavern.getContext().chatCompletionSettings.prompts;
            for (var i = 0; i < prompts.length; i++) {
                if (prompts[i].identifier === id) return prompts[i];
            }
        } catch (e) {}
        return null;
    }
    function isItemEnabled(id) {
        var order = getActiveOrder();
        for (var i = 0; i < order.length; i++) {
            if (order[i].identifier === id) return order[i].enabled;
        }
        return false;
    }
    function toggleItem(id) {
        var el = document.querySelector('[data-pm-identifier="' + id + '"] .prompt-manager-toggle-action');
        if (el) el.click();
    }
    function batchToggle(ids, enable, callback) {
        var idx = 0;
        function next() {
            if (idx >= ids.length) { if (callback) callback(); return; }
            var id = ids[idx];
            var on = isItemEnabled(id);
            if (enable && !on) toggleItem(id);
            else if (!enable && on) toggleItem(id);
            idx++;
            setTimeout(next, 40);
        }
        next();
    }
    function mk(tag, cls, txt) {
        var e = document.createElement(tag);
        e.className = cls;
        if (txt) e.textContent = txt;
        return e;
    }
    function countGroupEnabled(g) {
        var on = 0;
        for (var j = 0; j < g.ids.length; j++) {
            if (isItemEnabled(g.ids[j])) on++;
        }
        return on;
    }

    var host = document.createElement("div");
    host.id = "bny-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    var styleEl = document.createElement("style");
    styleEl.textContent =
        "*{box-sizing:border-box;margin:0;padding:0;}" +
        "::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#e0c0c8;border-radius:4px;}" +
        ".overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:auto;display:none;background:transparent;}" +
        ".fab{position:fixed;font-size:24px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;border:2px solid rgba(255,255,255,.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform .15s;z-index:10;overflow:hidden;display:flex;align-items:center;justify-content:center;}" +
        ".fab:active{transform:scale(.9);}" +
        ".fab img{width:100%;height:100%;object-fit:cover;pointer-events:none;}" +
        ".fab.shape-none{background:none !important;border:none !important;box-shadow:none !important;border-radius:0 !important;overflow:visible !important;}" +
        ".fab.shape-none img{object-fit:contain !important;}" +
        ".fab.shape-round{border-radius:50% !important;}" +
        ".fab.shape-rounded{border-radius:12px !important;}" +
        ".pnl{position:fixed;width:90vw;max-width:420px;height:75vh;max-height:650px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}" +
        ".tabs{display:flex;background:#fff;border-bottom:1px solid #fde2e8;flex-shrink:0;}" +
        ".tab{flex:1;padding:10px 0;text-align:center;font-size:11px;cursor:pointer;color:#aaa;border-bottom:2px solid transparent;transition:.2s;white-space:nowrap;}" +
        ".tab.on{color:#c44569;border-bottom-color:#c44569;font-weight:bold;}" +
        ".tc{flex:1;display:none;flex-direction:column;overflow:hidden;}" +
        ".tc.on{display:flex;}" +
        ".sh{display:flex;align-items:center;padding:8px 10px;background:#fff;border-bottom:1px solid #fde2e8;gap:5px;flex-shrink:0;position:relative;}" +
        ".sh input{flex:1;height:34px;border:1px solid #f0d0d8;border-radius:20px;padding:0 12px;font-size:13px;outline:none;background:#fffafc;color:#333;min-width:0;}" +
        ".sh input:focus{border-color:#ff6b9d;}" +
        ".btn{height:34px;padding:0 10px;border:none;border-radius:20px;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0;}" +
        ".bgo{background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;}" +
        ".bcl{background:#f0e0e4;color:#c44569;font-size:11px;padding:0 8px;}" +
        ".etag{font-size:10px;color:#c44569;background:#fde2e8;padding:2px 8px;border-radius:10px;flex-shrink:0;cursor:pointer;user-select:none;}" +
        ".epop{position:absolute;top:44px;left:10px;background:#fff;border:1px solid #fde2e8;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:10;overflow:hidden;display:none;}" +
        ".eitem{padding:10px 20px;font-size:13px;color:#666;cursor:pointer;display:flex;align-items:center;gap:8px;}" +
        ".eitem:active{background:#fff5f8;}" +
        ".eitem.on{color:#c44569;font-weight:bold;}" +
        ".eitem.on::before{content:'\\2713';}" +
        ".eitem:not(.on)::before{content:'';display:inline-block;width:14px;}" +
        ".hl{display:flex;gap:6px;padding:4px 10px;background:#f9f5f7;border-bottom:1px solid #fde2e8;flex-shrink:0;overflow-x:auto;white-space:nowrap;}" +
        ".hc{display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #fde2e8;border-radius:14px;padding:3px 8px;font-size:11px;color:#999;flex-shrink:0;cursor:pointer;}" +
        ".hc .ht{max-width:80px;overflow:hidden;text-overflow:ellipsis;}" +
        ".hc .hx{color:#ddd;font-size:13px;padding:0 2px;}" +
        ".sb{flex:1;position:relative;background:#fff;overflow:hidden;}" +
        ".sb iframe{width:100%;height:100%;border:none;}" +
        ".fb{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.95);border:1px solid #fde2e8;padding:6px 16px;border-radius:20px;font-size:11px;color:#c44569;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.1);text-decoration:none;z-index:1;}" +
        ".tip{display:flex;align-items:center;justify-content:center;height:100%;color:#ccc;font-size:13px;text-align:center;padding:20px;line-height:1.8;}" +
        ".gs{position:relative;flex-shrink:0;}" +
        ".gs-bar{display:flex;align-items:center;padding:10px 12px;background:#f9f0f3;border-bottom:1px solid #fde2e8;cursor:pointer;gap:8px;}" +
        ".gs-name{flex:1;font-size:13px;color:#c44569;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".gs-cnt{font-size:11px;color:#aaa;}" +
        ".gs-arr{font-size:10px;color:#ccc;}" +
        ".gs-drop{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #fde2e8;border-top:none;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:10;max-height:240px;overflow-y:auto;display:none;}" +
        ".gs-item{display:flex;align-items:center;padding:10px 14px;gap:8px;cursor:pointer;border-bottom:1px solid #f8f0f2;}" +
        ".gs-item.on{background:#fff0f5;}" +
        ".gs-item .gi-dot{width:8px;height:8px;border-radius:50%;border:2px solid #ddd;flex-shrink:0;}" +
        ".gs-item.on .gi-dot{background:#ff6b9d;border-color:#ff6b9d;}" +
        ".gs-item .gi-name{flex:1;font-size:12px;color:#555;}" +
        ".gs-item.on .gi-name{color:#c44569;font-weight:bold;}" +
        ".gs-item .gi-cnt{font-size:10px;color:#bbb;}" +
        ".pf{display:flex;align-items:center;padding:8px 10px;background:#fff;border-bottom:1px solid #fde2e8;gap:5px;flex-shrink:0;}" +
        ".pf input{flex:1;height:32px;border:1px solid #f0d0d8;border-radius:20px;padding:0 12px;font-size:12px;outline:none;background:#fffafc;}" +
        ".pl{flex:1;overflow-y:auto;padding:4px 0;}" +
        ".pi{display:flex;align-items:center;padding:6px 12px;gap:8px;border-bottom:1px solid #f8f0f2;}" +
        ".pi .pn{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".pi .pn.on-c{color:#c44569;}" +
        ".pi .pn.off-c{color:#aaa;}" +
        ".pi .pt{position:relative;width:40px;height:22px;background:#ddd;border-radius:11px;cursor:pointer;transition:.2s;flex-shrink:0;}" +
        ".pi .pt.on{background:#ff6b9d;}" +
        ".pi .pt::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s;}" +
        ".pi .pt.on::after{left:20px;}" +
        ".pi .pc2{width:18px;height:18px;border:2px solid #ddd;border-radius:4px;cursor:pointer;flex-shrink:0;position:relative;}" +
        ".pi .pc2.on{background:#ff6b9d;border-color:#ff6b9d;}" +
        ".pi .pc2.on::after{content:'\\2713';position:absolute;top:-2px;left:2px;color:#fff;font-size:12px;}" +
        ".mgr-hd{padding:10px 12px;background:#f9f0f3;border-bottom:1px solid #fde2e8;font-size:13px;color:#c44569;font-weight:bold;}" +
        ".mgr-item{display:flex;align-items:center;padding:10px 12px;gap:8px;border-bottom:1px solid #f8f0f2;background:#fff;}" +
        ".mgr-item.dragging{background:#fff0f5;opacity:.6;}" +
        ".mgr-item.over{border-top:2px solid #ff6b9d;}" +
        ".mgr-handle{font-size:16px;color:#ccc;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;padding:0 4px;}" +
        ".mgr-name{flex:1;font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".mgr-cnt{font-size:10px;color:#aaa;}" +
        ".mgr-btn{background:none;border:none;font-size:14px;cursor:pointer;padding:4px;}" +
        ".mgr-empty{text-align:center;padding:30px;color:#ccc;font-size:12px;}" +
        ".pmsg{text-align:center;padding:4px;font-size:11px;color:#888;flex-shrink:0;min-height:20px;}" +
        ".pbar{display:flex;gap:4px;padding:6px 10px;background:#fff;border-top:1px solid #fde2e8;flex-shrink:0;flex-wrap:wrap;}" +
        ".pbar .pbtn{flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;}" +
        ".pbar .pbtn.pink{background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;}" +
        ".pbar .pbtn.purple{background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;}" +
        ".pbar .pbtn.green{background:linear-gradient(135deg,#34d399,#059669);color:#fff;}" +
        ".pbar .pbtn.red{background:linear-gradient(135deg,#f87171,#dc2626);color:#fff;}" +
        ".pbar .pbtn.gray{background:#f0e0e4;color:#c44569;}" +
        ".pbar .pbtn.blue{background:linear-gradient(135deg,#60a5fa,#3b82f6);color:#fff;}" +
        ".cmd-grp-hd{display:flex;align-items:center;padding:8px 12px;background:#f9f0f3;border-bottom:1px solid #fde2e8;cursor:pointer;gap:6px;}" +
        ".cmd-grp-hd .cg-arrow{font-size:10px;color:#ccc;transition:transform .2s;}" +
        ".cmd-grp-hd .cg-arrow.open{transform:rotate(90deg);}" +
        ".cmd-grp-hd .cg-name{flex:1;font-size:12px;color:#c44569;font-weight:bold;}" +
        ".cmd-grp-hd .cg-cnt{font-size:10px;color:#aaa;}" +
        ".cmd-item{display:flex;align-items:center;padding:8px 12px;gap:8px;border-bottom:1px solid #f8f0f2;cursor:pointer;background:#fff;}" +
        ".cmd-item:active{background:#fff5f8;}" +
        ".cmd-item .ci-icon{font-size:14px;flex-shrink:0;}" +
        ".cmd-item .ci-name{flex:1;font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".cmd-item .ci-badge{font-size:9px;padding:2px 6px;border-radius:8px;flex-shrink:0;}" +
        ".cmd-item .ci-badge.send{background:#dcfce7;color:#16a34a;}" +
        ".cmd-item .ci-badge.fill{background:#fde2e8;color:#c44569;}" +
        ".cmd-item .ci-edit{background:none;border:none;font-size:13px;cursor:pointer;padding:2px 4px;flex-shrink:0;}" +
        ".cmd-form{padding:10px 12px;overflow-y:auto;flex:1;}" +
        ".cmd-form label.cf-label{display:block;font-size:11px;color:#999;margin:8px 0 4px;}" +
        ".cmd-form label.cf-label:first-child{margin-top:0;}" +
        ".cmd-form input[type=text]{width:100%;height:34px;border:1px solid #f0d0d8;border-radius:10px;padding:0 12px;font-size:13px;outline:none;background:#fffafc;color:#333;}" +
        ".cmd-form input[type=text]:focus{border-color:#ff6b9d;}" +
        ".cmd-form textarea{width:100%;height:80px;border:1px solid #f0d0d8;border-radius:10px;padding:8px 12px;font-size:12px;outline:none;background:#fffafc;color:#333;resize:vertical;font-family:inherit;}" +
        ".cmd-form textarea:focus{border-color:#ff6b9d;}" +
        ".cmd-form select{width:100%;height:34px;border:1px solid #f0d0d8;border-radius:10px;padding:0 10px;font-size:12px;outline:none;background:#fffafc;color:#333;}" +
        ".cf-radio{display:flex;gap:12px;padding:6px 0;}" +
        ".cf-radio label{display:inline-flex !important;align-items:center !important;gap:4px !important;font-size:12px !important;color:#555 !important;cursor:pointer !important;margin:0 !important;}" +
        ".cf-var{font-size:10px;color:#aaa;padding:6px 0;line-height:1.6;}" +
        ".skin-scroll{flex:1;overflow-y:auto;padding:10px 12px;}" +
        ".skin-section{margin-bottom:14px;}" +
        ".skin-section-title{font-size:11px;color:#c44569;font-weight:bold;margin-bottom:8px;}" +
        ".skin-grid{display:flex;flex-wrap:wrap;gap:8px;}" +
        ".skin-card{width:60px;text-align:center;cursor:pointer;position:relative;}" +
        ".skin-card .sc-img{width:52px;height:52px;border:2px solid #eee;border-radius:8px;overflow:hidden;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;background:#fafafa;}" +
        ".skin-card .sc-img img{width:100%;height:100%;object-fit:contain;}" +
        ".skin-card .sc-img.active{border-color:#ff6b9d;box-shadow:0 0 8px rgba(255,107,157,.4);}" +
        ".skin-card .sc-name{font-size:9px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".skin-card .sc-del{position:absolute;top:-4px;right:2px;width:16px;height:16px;background:#f87171;color:#fff;border-radius:50%;font-size:10px;line-height:16px;text-align:center;cursor:pointer;display:none;}" +
        ".skin-card:hover .sc-del{display:block;}" +
        ".skin-slider{display:flex;align-items:center;gap:8px;margin:6px 0;}" +
        ".skin-slider input[type=range]{flex:1;}" +
        ".skin-slider .ss-val{font-size:11px;color:#c44569;min-width:35px;text-align:center;}" +
        ".skin-shapes{display:flex;gap:8px;margin:6px 0;}" +
        ".skin-shapes .ss-opt{padding:4px 10px;border:1px solid #eee;border-radius:8px;font-size:11px;color:#888;cursor:pointer;}" +
        ".skin-shapes .ss-opt.active{border-color:#ff6b9d;color:#c44569;background:#fff5f8;}";
    shadow.appendChild(styleEl);
var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); closeP(); });
    overlay.addEventListener("touchstart", function (e) { e.preventDefault(); e.stopPropagation(); closeP(); });
    shadow.appendChild(overlay);

    var fab = document.createElement("div");
    fab.className = "fab";
    fab.innerHTML = "&#x1F430;";
    fab.style.display = "none";
    shadow.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "pnl";
    panel.innerHTML =
        '<div class="tabs">' +
        '<div class="tab on" data-t="search">🔍 搜索</div>' +
        '<div class="tab" data-t="preset">📋 预设</div>' +
        '<div class="tab" data-t="cmd">📌 指令</div>' +
        '<div class="tab" data-t="skin">🎨 皮肤</div>' +
        '</div>' +
        '<div class="tc on" data-t="search">' +
        '<div class="sh">' +
        '<span class="etag"></span>' +
        '<input type="text" class="si" placeholder="搜索或输入网址..." />' +
        '<button class="btn bgo sbtn">搜索</button>' +
        '<button class="btn bcl cbtn">清空</button>' +
        '<div class="epop"></div>' +
        '</div>' +
        '<div class="hl" style="display:none;"></div>' +
        '<div class="sb"><div class="tip">选中文字后点🐰自动搜索<br/>输入网址可直接访问</div><iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer" style="display:none;"></iframe><a class="fb" target="_blank" rel="noopener" style="display:none;">加载不出来？点这里 ↗</a></div>' +
        '</div>' +
        '<div class="tc" data-t="preset">' +
        '<div class="gs">' +
        '<div class="gs-bar"><span class="gs-name">📋 全部条目</span><span class="gs-cnt"></span><span class="gs-arr">▼</span></div>' +
        '<div class="gs-drop"></div>' +
        '</div>' +
        '<div class="pf"><input type="text" class="pfin" placeholder="🔍 筛选条目名称..." /><button class="btn bcl refbtn">刷新</button></div>' +
        '<div class="pl"></div>' +
        '<div class="pmsg"></div>' +
        '<div class="pbar"></div>' +
        '</div>' +
        '<div class="tc" data-t="cmd">' +
        '<div class="cmd-list" style="flex:1;overflow-y:auto;"></div>' +
        '<div class="cmd-form" style="display:none;"></div>' +
        '<div class="cmd-msg" style="text-align:center;padding:4px;font-size:11px;color:#888;flex-shrink:0;min-height:20px;"></div>' +
        '<div class="cmd-bar" style="display:flex;gap:4px;padding:6px 10px;background:#fff;border-top:1px solid #fde2e8;flex-shrink:0;flex-wrap:wrap;"></div>' +
        '</div>' +
        '<div class="tc" data-t="skin">' +
        '<div class="skin-scroll"></div>' +
        '</div>';
    shadow.appendChild(panel);

    var tabEls = panel.querySelectorAll(".tab");
    var tcEls = panel.querySelectorAll(".tc");
    var sInput = panel.querySelector(".si");
    var sBtnEl = panel.querySelector(".sbtn");
    var cBtnEl = panel.querySelector(".cbtn");
    var iframe = panel.querySelector("iframe");
    var fbLink = panel.querySelector(".fb");
    var tipEl = panel.querySelector(".tip");
    var eTag = panel.querySelector(".etag");
    var ePop = panel.querySelector(".epop");
    var hlEl = panel.querySelector(".hl");
    var gsBar = panel.querySelector(".gs-bar");
    var gsName = panel.querySelector(".gs-name");
    var gsCnt = panel.querySelector(".gs-cnt");
    var gsDrop = panel.querySelector(".gs-drop");
    var pfInput = panel.querySelector(".pfin");
    var pfBar = panel.querySelector(".pf");
    var refBtn = panel.querySelector(".refbtn");
    var plEl = panel.querySelector(".pl");
    var pmsgEl = panel.querySelector(".pmsg");
    var pbarEl = panel.querySelector(".pbar");
    var cmdListEl = panel.querySelector(".cmd-list");
    var cmdFormEl = panel.querySelector(".cmd-form");
    var cmdMsgEl = panel.querySelector(".cmd-msg");
    var cmdBarEl = panel.querySelector(".cmd-bar");
    var skinScroll = panel.querySelector(".skin-scroll");

    var panelOpen = false;
    var hasSearch = false;
    var currentGroup = null;
    var editingGroup = null;
    var selectMode = false;
    var manageMode = false;
    var selected = {};
    var cmdEditing = null;
    var cmdFormMode = false;
    var cmdOpenGroups = {};

    tabEls.forEach(function (t) {
        t.addEventListener("click", function (e) {
            e.stopPropagation();
            var v = this.getAttribute("data-t");
            tabEls.forEach(function (x) { x.classList.remove("on"); });
            tcEls.forEach(function (x) { x.classList.remove("on"); });
            this.classList.add("on");
            panel.querySelector('.tc[data-t="' + v + '"]').classList.add("on");
            if (v === "preset") renderAll();
            if (v === "cmd") renderCmd();
            if (v === "skin") renderSkin();
        });
    });

    function isUrl(s) { s = s.trim().toLowerCase(); return s.indexOf("http://") === 0 || s.indexOf("https://") === 0 || /^[a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,}/.test(s); }
    function toUrl(s) { s = s.trim(); if (s.indexOf("http") !== 0) s = "https://" + s; return s; }
    function doSearch(q) {
        if (!q.trim()) return;
        q = q.trim();
        var eng = getEngine();
        eTag.textContent = eng.name;
        if (isUrl(q)) { iframe.src = toUrl(q); fbLink.href = toUrl(q); }
        else { iframe.src = eng.search(q); fbLink.href = eng.fallback(q); addHistory(q); renderHistory(); }
        iframe.style.display = "block"; tipEl.style.display = "none"; fbLink.style.display = "block"; hasSearch = true;
    }
    function clearS() { iframe.src = ""; iframe.style.display = "none"; tipEl.style.display = "flex"; fbLink.style.display = "none"; sInput.value = ""; hasSearch = false; }
    sBtnEl.addEventListener("click", function (e) { e.stopPropagation(); doSearch(sInput.value); });
    cBtnEl.addEventListener("click", function (e) { e.stopPropagation(); clearS(); });
    sInput.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") doSearch(sInput.value); });
    sInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    sInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    sInput.addEventListener("input", function (e) { e.stopPropagation(); });

    eTag.textContent = getEngine().name;
    eTag.addEventListener("click", function (e) {
        e.stopPropagation();
        var curKey = localStorage.getItem("bnyEngine") || "google";
        ePop.innerHTML = "";
        for (var ei = 0; ei < engineKeys.length; ei++) {
            (function (k) {
                var item = document.createElement("div");
                item.className = "eitem" + (k === curKey ? " on" : "");
                item.textContent = engines[k].name;
                item.addEventListener("click", function (ev) { ev.stopPropagation(); setEngine(k); eTag.textContent = engines[k].name; ePop.style.display = "none"; });
                ePop.appendChild(item);
            })(engineKeys[ei]);
        }
        ePop.style.display = (ePop.style.display === "block") ? "none" : "block";
    });

    function renderHistory() {
        var hist = loadHistory();
        if (hist.length === 0) { hlEl.style.display = "none"; return; }
        hlEl.style.display = "flex"; hlEl.innerHTML = "";
        for (var hi = 0; hi < hist.length; hi++) {
            (function (q, idx) {
                var chip = document.createElement("div"); chip.className = "hc";
                var htSpan = document.createElement("span"); htSpan.className = "ht"; htSpan.textContent = q;
                htSpan.addEventListener("click", function (e) { e.stopPropagation(); sInput.value = q; doSearch(q); });
                var hxSpan = document.createElement("span"); hxSpan.className = "hx"; hxSpan.textContent = "×";
                hxSpan.addEventListener("click", function (e) { e.stopPropagation(); var arr = loadHistory(); arr.splice(idx, 1); saveHistory(arr); renderHistory(); });
                chip.appendChild(htSpan); chip.appendChild(hxSpan); hlEl.appendChild(chip);
            })(hist[hi], hi);
        }
    }
    renderHistory();

    panel.addEventListener("click", function () { ePop.style.display = "none"; gsDrop.style.display = "none"; });

    gsBar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (manageMode) return;
        gsDrop.style.display = (gsDrop.style.display === "block") ? "none" : "block";
        if (gsDrop.style.display === "block") renderDropdown();
    });

    function renderDropdown() {
        var groups = loadGroups(); gsDrop.innerHTML = "";
        var allItem = document.createElement("div"); allItem.className = "gs-item" + (currentGroup === null ? " on" : "");
        allItem.innerHTML = '<span class="gi-dot"></span><span class="gi-name">📋 全部条目</span>';
        allItem.addEventListener("click", function (e) { e.stopPropagation(); currentGroup = null; editingGroup = null; selectMode = false; selected = {}; gsDrop.style.display = "none"; renderAll(); });
        gsDrop.appendChild(allItem);
        for (var gi = 0; gi < groups.length; gi++) {
            (function (idx) {
                var g = groups[idx]; var on = countGroupEnabled(g);
                var item = document.createElement("div"); item.className = "gs-item" + (currentGroup === idx ? " on" : "");
                item.innerHTML = '<span class="gi-dot"></span><span class="gi-name">📁 ' + g.name + '</span><span class="gi-cnt">' + on + '/' + g.ids.length + '条</span>';
                item.addEventListener("click", function (e) { e.stopPropagation(); currentGroup = idx; editingGroup = null; selectMode = false; selected = {}; gsDrop.style.display = "none"; renderAll(); });
                gsDrop.appendChild(item);
            })(gi);
        }
    }

    pfInput.addEventListener("input", function (e) { e.stopPropagation(); renderList(); });
    pfInput.addEventListener("keydown", function (e) { e.stopPropagation(); });
    pfInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    pfInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    refBtn.addEventListener("click", function (e) { e.stopPropagation(); renderAll(); pmsgEl.textContent = "🔄 已刷新"; pmsgEl.style.color = "#888"; });

    function renderAll() { if (manageMode) { renderManage(); return; } renderBar(); renderList(); renderActions(); }

    function renderBar() {
        var groups = loadGroups();
        if (editingGroup !== null && groups[editingGroup]) { gsName.textContent = "✏️ 编辑：" + groups[editingGroup].name; gsCnt.textContent = ""; }
        else if (currentGroup !== null && groups[currentGroup]) { var g = groups[currentGroup]; var on = countGroupEnabled(g); gsName.textContent = "📁 " + g.name; gsCnt.textContent = on + "/" + g.ids.length + "条"; }
        else { gsName.textContent = "📋 全部条目"; gsCnt.textContent = getActiveOrder().length + "条"; }
    }

    function renderList() {
        var order = getActiveOrder(); var filter = pfInput.value.trim().toLowerCase(); var groups = loadGroups();
        plEl.innerHTML = ""; pfBar.style.display = "flex";
        var shown = 0; var enabledCount = 0; var totalCount = 0;
        var showIds = null;
        if (editingGroup === null && currentGroup !== null && groups[currentGroup]) {
            showIds = {};
            for (var si = 0; si < groups[currentGroup].ids.length; si++) { showIds[groups[currentGroup].ids[si]] = true; }
        }
        for (var li = 0; li < order.length; li++) {
            (function (entry) {
                var id = entry.identifier; var p = getPromptById(id); var name = p ? (p.name || id) : id;
                if (filter && name.toLowerCase().indexOf(filter) === -1) return;
                if (showIds && !showIds[id]) return;
                var en = isItemEnabled(id); totalCount++; if (en) enabledCount++;
                var row = document.createElement("div"); row.className = "pi";
                var nameEl = document.createElement("div"); nameEl.className = "pn " + (en ? "on-c" : "off-c"); nameEl.textContent = name;
                if (selectMode || editingGroup !== null) {
                    var chk = document.createElement("div"); chk.className = "pc2" + (selected[id] ? " on" : "");
                    chk.addEventListener("click", function (e) {
                        e.stopPropagation(); selected[id] = !selected[id];
                        if (selected[id]) chk.classList.add("on"); else chk.classList.remove("on");
                        var cnt = 0; for (var ck in selected) { if (selected[ck]) cnt++; }
                        pmsgEl.textContent = "已选 " + cnt + " 条"; pmsgEl.style.color = "#c44569";
                    });
                    row.appendChild(nameEl); row.appendChild(chk);
                } else {
                    var tog = document.createElement("div"); tog.className = "pt" + (en ? " on" : "");
                    tog.addEventListener("click", function (e) {
                        e.stopPropagation(); toggleItem(id);
                        setTimeout(function () {
                            var nowOn = isItemEnabled(id);
                            if (nowOn) { tog.classList.add("on"); nameEl.className = "pn on-c"; } else { tog.classList.remove("on"); nameEl.className = "pn off-c"; }
                            pmsgEl.textContent = (nowOn ? "✅ 开启" : "❌ 关闭") + " " + name; pmsgEl.style.color = nowOn ? "#27ae60" : "#e74c3c";
                            updateCount(); renderBar();
                        }, 50);
                    });
                    row.appendChild(nameEl); row.appendChild(tog);
                }
                plEl.appendChild(row); shown++;
            })(order[li]);
        }
        if (shown === 0) plEl.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:12px;">没有找到条目</div>';
        if (!(selectMode || editingGroup !== null)) { pmsgEl.textContent = "开启 " + enabledCount + " / " + totalCount + " 条"; pmsgEl.style.color = "#888"; }
    }

    function updateCount() {
        var order = getActiveOrder(); var groups = loadGroups(); var showIds = null;
        if (editingGroup === null && currentGroup !== null && groups[currentGroup]) {
            showIds = {};
            for (var ui = 0; ui < groups[currentGroup].ids.length; ui++) { showIds[groups[currentGroup].ids[ui]] = true; }
        }
        var filter = pfInput.value.trim().toLowerCase(); var en = 0; var tot = 0;
        for (var oi = 0; oi < order.length; oi++) {
            var uid = order[oi].identifier; var up = getPromptById(uid); var uname = up ? (up.name || uid) : uid;
            if (filter && uname.toLowerCase().indexOf(filter) === -1) continue;
            if (showIds && !showIds[uid]) continue;
            tot++; if (isItemEnabled(uid)) en++;
        }
        pmsgEl.textContent = "开启 " + en + " / " + tot + " 条"; pmsgEl.style.color = "#888";
    }

    function renderActions() {
        pbarEl.innerHTML = ""; var groups = loadGroups();
        if (editingGroup !== null) {
            var edSave = mk("button", "pbtn green", "✅ 保存");
            edSave.addEventListener("click", function (e) {
                e.stopPropagation(); var ids = []; for (var ek in selected) { if (selected[ek]) ids.push(ek); }
                if (ids.length === 0) { pmsgEl.textContent = "⚠️ 至少选一条！"; pmsgEl.style.color = "#e74c3c"; return; }
                var gs = loadGroups(); gs[editingGroup].ids = ids; saveGroups(gs);
                pmsgEl.textContent = "✅ 已保存"; pmsgEl.style.color = "#27ae60"; editingGroup = null; selected = {}; renderAll();
            });
            var edCan = mk("button", "pbtn gray", "✖ 取消");
            edCan.addEventListener("click", function (e) { e.stopPropagation(); editingGroup = null; selected = {}; renderAll(); });
            pbarEl.appendChild(edSave); pbarEl.appendChild(edCan);
        } else if (selectMode) {
            var slSave = mk("button", "pbtn purple", "💾 存为组");
            slSave.addEventListener("click", function (e) {
                e.stopPropagation(); var ids = []; for (var sk in selected) { if (selected[sk]) ids.push(sk); }
                if (ids.length === 0) { pmsgEl.textContent = "⚠️ 请先勾选！"; pmsgEl.style.color = "#e74c3c"; return; }
                var nm = prompt("给分组取个名字："); if (!nm || !nm.trim()) return;
                var gs = loadGroups(); gs.push({ name: nm.trim(), ids: ids }); saveGroups(gs);
                selectMode = false; selected = {}; currentGroup = gs.length - 1; renderAll();
                pmsgEl.textContent = "✅ 已创建「" + nm.trim() + "」" + ids.length + "条"; pmsgEl.style.color = "#27ae60";
            });
            var slCan = mk("button", "pbtn gray", "✖ 取消");
            slCan.addEventListener("click", function (e) { e.stopPropagation(); selectMode = false; selected = {}; renderAll(); });
            pbarEl.appendChild(slSave); pbarEl.appendChild(slCan);
        } else if (currentGroup !== null && groups[currentGroup]) {
            var cg = groups[currentGroup];
            var cgOn = mk("button", "pbtn green", "🔛 全开");
            cgOn.addEventListener("click", function (e) { e.stopPropagation(); pmsgEl.textContent = "⏳ 批量开启中..."; batchToggle(cg.ids, true, function () { renderList(); renderBar(); }); });
            var cgOff = mk("button", "pbtn red", "🔌 全关");
            cgOff.addEventListener("click", function (e) { e.stopPropagation(); pmsgEl.textContent = "⏳ 批量关闭中..."; batchToggle(cg.ids, false, function () { renderList(); renderBar(); }); });
            var cgEdit = mk("button", "pbtn pink", "✏️ 编辑");
            cgEdit.addEventListener("click", function (e) {
                e.stopPropagation(); editingGroup = currentGroup; selected = {}; var gs = loadGroups();
                for (var ej = 0; ej < gs[currentGroup].ids.length; ej++) { selected[gs[currentGroup].ids[ej]] = true; }
                renderAll();
            });
            var cgRen = mk("button", "pbtn gray", "📝 改名");
            cgRen.addEventListener("click", function (e) { e.stopPropagation(); var gs = loadGroups(); var nm = prompt("新名字：", gs[currentGroup].name); if (!nm || !nm.trim()) return; gs[currentGroup].name = nm.trim(); saveGroups(gs); renderAll(); });
            var cgDel = mk("button", "pbtn red", "🗑 删除");
            cgDel.addEventListener("click", function (e) { e.stopPropagation(); if (!confirm("确定删除「" + cg.name + "」分组吗？")) return; var gs = loadGroups(); gs.splice(currentGroup, 1); saveGroups(gs); currentGroup = null; renderAll(); });
            pbarEl.appendChild(cgOn); pbarEl.appendChild(cgOff); pbarEl.appendChild(cgEdit); pbarEl.appendChild(cgRen); pbarEl.appendChild(cgDel);
        } else {
            var abSel = mk("button", "pbtn pink", "☑ 多选建组");
            abSel.addEventListener("click", function (e) { e.stopPropagation(); selectMode = true; selected = {}; renderAll(); });
            var abOn = mk("button", "pbtn green", "🔛 全开");
            abOn.addEventListener("click", function (e) { e.stopPropagation(); pmsgEl.textContent = "⏳ 批量开启中..."; var ids = getActiveOrder().map(function (x) { return x.identifier; }); batchToggle(ids, true, function () { renderList(); renderBar(); }); });
            var abOff = mk("button", "pbtn red", "🔌 全关");
            abOff.addEventListener("click", function (e) { e.stopPropagation(); pmsgEl.textContent = "⏳ 批量关闭中..."; var ids = getActiveOrder().map(function (x) { return x.identifier; }); batchToggle(ids, false, function () { renderList(); renderBar(); }); });
            var abMgr = mk("button", "pbtn blue", "⚙️ 管理组");
            abMgr.addEventListener("click", function (e) { e.stopPropagation(); manageMode = true; renderAll(); });
            pbarEl.appendChild(abSel); pbarEl.appendChild(abOn); pbarEl.appendChild(abOff); pbarEl.appendChild(abMgr);
        }
    }

    function renderManage() {
        var groups = loadGroups(); gsName.textContent = "⚙️ 条目组管理"; gsCnt.textContent = groups.length + "个组"; pfBar.style.display = "none"; plEl.innerHTML = "";
        if (groups.length === 0) { plEl.innerHTML = '<div class="mgr-empty">还没有条目组<br/>回到全部条目模式多选建组吧 ✨</div>'; }
        else {
            var mgrHd = document.createElement("div"); mgrHd.className = "mgr-hd"; mgrHd.textContent = "长按 ≡ 拖拽排序"; plEl.appendChild(mgrHd);
            for (var mi = 0; mi < groups.length; mi++) {
                (function (idx) {
                    var g = groups[idx]; var on = countGroupEnabled(g);
                    var row = document.createElement("div"); row.className = "mgr-item"; row.setAttribute("data-idx", String(idx));
                    var handle = document.createElement("span"); handle.className = "mgr-handle"; handle.textContent = "≡";
                    var mname = document.createElement("span"); mname.className = "mgr-name"; mname.textContent = "📁 " + g.name;
                    var mcnt = document.createElement("span"); mcnt.className = "mgr-cnt"; mcnt.textContent = on + "/" + g.ids.length;
                    var mren = document.createElement("button"); mren.className = "mgr-btn"; mren.textContent = "📝";
                    mren.addEventListener("click", function (e) { e.stopPropagation(); var gs = loadGroups(); var nm = prompt("新名字：", gs[idx].name); if (!nm || !nm.trim()) return; gs[idx].name = nm.trim(); saveGroups(gs); renderManage(); });
                    var mdel = document.createElement("button"); mdel.className = "mgr-btn"; mdel.textContent = "🗑";
                    mdel.addEventListener("click", function (e) { e.stopPropagation(); var gs = loadGroups(); if (!confirm("确定删除「" + gs[idx].name + "」吗？")) return; gs.splice(idx, 1); saveGroups(gs); if (currentGroup === idx) currentGroup = null; else if (currentGroup !== null && currentGroup > idx) currentGroup--; renderManage(); });
                    var dragTimer = null; var isDrag = false; var dragFromIdx = null; var dragToIdx = null;
                    handle.addEventListener("touchstart", function (e) {
                        e.preventDefault(); e.stopPropagation();
                        dragTimer = setTimeout(function () { isDrag = true; dragFromIdx = idx; row.classList.add("dragging"); pmsgEl.textContent = "🔀 拖拽中..."; pmsgEl.style.color = "#c44569"; }, 200);
                    }, { passive: false });
                    handle.addEventListener("touchmove", function (e) {
                        e.preventDefault(); e.stopPropagation(); if (dragTimer) { clearTimeout(dragTimer); dragTimer = null; } if (!isDrag) return;
                        var touch = e.touches[0]; var items = plEl.querySelectorAll(".mgr-item"); items.forEach(function (it) { it.classList.remove("over"); });
                        for (var di = 0; di < items.length; di++) { var rect = items[di].getBoundingClientRect(); if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) { var overI = parseInt(items[di].getAttribute("data-idx")); if (overI !== dragFromIdx) { items[di].classList.add("over"); dragToIdx = overI; } break; } }
                    }, { passive: false });
                    handle.addEventListener("touchend",function (e) {
                        e.preventDefault(); e.stopPropagation(); if (dragTimer) { clearTimeout(dragTimer); dragTimer = null; }
                        if (isDrag && dragFromIdx !== null && dragToIdx !== null && dragFromIdx !== dragToIdx) {
                            var gs = loadGroups(); var moved = gs.splice(dragFromIdx, 1)[0]; gs.splice(dragToIdx, 0, moved); saveGroups(gs);
                            if (currentGroup === dragFromIdx) currentGroup = dragToIdx;
                            else if (currentGroup !== null) { if (dragFromIdx < currentGroup && dragToIdx >= currentGroup) currentGroup--; else if (dragFromIdx > currentGroup && dragToIdx <= currentGroup) currentGroup++; }
                            pmsgEl.textContent = "✅ 已移动"; pmsgEl.style.color = "#27ae60";
                        }
                        isDrag = false; dragFromIdx = null; dragToIdx = null; renderManage();
                    }, { passive: false });
                    handle.addEventListener("mousedown", function (e) {
                        e.preventDefault(); e.stopPropagation(); isDrag = true; dragFromIdx = idx; row.classList.add("dragging");
                        var onMM = function (ev) {
                            var items = plEl.querySelectorAll(".mgr-item"); items.forEach(function (it) { it.classList.remove("over"); });
                            for (var di = 0; di < items.length; di++) { var rect = items[di].getBoundingClientRect(); if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) { var overI = parseInt(items[di].getAttribute("data-idx")); if (overI !== dragFromIdx) { items[di].classList.add("over"); dragToIdx = overI; } break; } }
                        };
                        var onMU = function () {
                            document.removeEventListener("mousemove", onMM); document.removeEventListener("mouseup", onMU);
                            if (isDrag && dragFromIdx !== null && dragToIdx !== null && dragFromIdx !== dragToIdx) { var gs = loadGroups(); var moved = gs.splice(dragFromIdx, 1)[0]; gs.splice(dragToIdx, 0, moved); saveGroups(gs); if (currentGroup === dragFromIdx) currentGroup = dragToIdx; }
                            isDrag = false; dragFromIdx = null; dragToIdx = null; renderManage();
                        };
                        document.addEventListener("mousemove", onMM); document.addEventListener("mouseup", onMU);
                    });
                    row.appendChild(handle); row.appendChild(mname); row.appendChild(mcnt); row.appendChild(mren); row.appendChild(mdel); plEl.appendChild(row);
                })(mi);
            }
        }
        pbarEl.innerHTML = "";
        var doneBtn = mk("button", "pbtn green", "✅ 完成");
        doneBtn.addEventListener("click", function (e) { e.stopPropagation(); manageMode = false; renderAll(); });
        pbarEl.appendChild(doneBtn);
    }

    /* ========== 指令板 ========== */
    function renderCmd() {
        if (cmdFormMode) { renderCmdForm(); return; }
        cmdFormEl.style.display = "none"; cmdListEl.style.display = "block";
        var data = loadCmdData(); cmdListEl.innerHTML = "";
        if (data.length === 0) {
            cmdListEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#ccc;font-size:12px;line-height:2;">还没有指令<br/>点下方 ➕ 添加你常用的指令吧！<br/><br/>💡 支持变量：<br/>{{user}} {{char}} {{date}} {{time}}</div>';
        } else {
            for (var di = 0; di < data.length; di++) {
                (function (gIdx) {
                    var grp = data[gIdx];
                    var isOpen = cmdOpenGroups[gIdx] !== false;
                    var hd = document.createElement("div"); hd.className = "cmd-grp-hd";
                    var arrow = document.createElement("span"); arrow.className = "cg-arrow" + (isOpen ? " open" : ""); arrow.textContent = "▶";
                    var gname = document.createElement("span"); gname.className = "cg-name"; gname.textContent = "📁 " + grp.name;
                    var gcnt = document.createElement("span"); gcnt.className = "cg-cnt"; gcnt.textContent = grp.cmds.length + "条";
                    hd.appendChild(arrow); hd.appendChild(gname); hd.appendChild(gcnt);
                    hd.addEventListener("click", function (e) { e.stopPropagation(); cmdOpenGroups[gIdx] = !isOpen; renderCmd(); });
                    cmdListEl.appendChild(hd);
                    if (isOpen) {
                        for (var ci = 0; ci < grp.cmds.length; ci++) {
                            (function (cmdIdx) {
                                var cmd = grp.cmds[cmdIdx];
                                var row = document.createElement("div"); row.className = "cmd-item";
                                var icon = document.createElement("span"); icon.className = "ci-icon"; icon.textContent = cmd.action === "send" ? "⚡" : "✏️";
                                var cname = document.createElement("span"); cname.className = "ci-name"; cname.textContent = cmd.name;
                                var badge = document.createElement("span"); badge.className = "ci-badge " + cmd.action; badge.textContent = cmd.action === "send" ? "直接发" : "填入";
                                var editBtn = document.createElement("button"); editBtn.className = "ci-edit"; editBtn.textContent = "⚙";
                                editBtn.addEventListener("click", function (e) { e.stopPropagation(); cmdEditing = { gIdx: gIdx, cmdIdx: cmdIdx }; cmdFormMode = true; renderCmd(); });
                                row.addEventListener("click", function (e) {
                                    e.stopPropagation();
                                    sendToInput(cmd.content, cmd.action === "send");
                                    cmdMsgEl.textContent = (cmd.action === "send" ? "⚡ 已发送：" : "✏️ 已填入：") + cmd.name;
                                    cmdMsgEl.style.color = cmd.action === "send" ? "#16a34a" : "#c44569";
                                    if (cmd.action === "send") setTimeout(function () { closeP(); }, 300);
                                });
                                row.appendChild(icon); row.appendChild(cname); row.appendChild(badge); row.appendChild(editBtn);
                                cmdListEl.appendChild(row);
                            })(ci);
                        }
                        if (grp.cmds.length === 0) {
                            var empty = document.createElement("div"); empty.style.cssText = "text-align:center;padding:15px;color:#ddd;font-size:11px;"; empty.textContent = "这个分组还没有指令";
                            cmdListEl.appendChild(empty);
                        }
                    }
                })(di);
            }
        }
        cmdMsgEl.textContent = ""; renderCmdBar();
    }

    function renderCmdBar() {
        cmdBarEl.innerHTML = "";
        var addBtn = mk("button", "pbtn pink", "➕ 添加指令"); addBtn.style.cssText = "flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;";
        addBtn.addEventListener("click", function (e) { e.stopPropagation(); cmdEditing = null; cmdFormMode = true; renderCmd(); });
        var mgrBtn = mk("button", "pbtn blue", "⚙️ 管理分组"); mgrBtn.style.cssText = "flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;";
        mgrBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var data = loadCmdData();
            var action = prompt("输入操作：\n1 = 添加分组\n2 = 删除分组\n3 = 重命名分组");
            if (action === "1") {
                var nm = prompt("新分组名称："); if (!nm || !nm.trim()) return;
                data.push({ name: nm.trim(), cmds: [] }); saveCmdData(data); renderCmd();
                cmdMsgEl.textContent = "✅ 已添加分组「" + nm.trim() + "」"; cmdMsgEl.style.color = "#27ae60";
            } else if (action === "2") {
                if (data.length === 0) { cmdMsgEl.textContent = "⚠️ 没有分组"; cmdMsgEl.style.color = "#e74c3c"; return; }
                var list = ""; for (var di = 0; di < data.length; di++) { list += (di + 1) + " = " + data[di].name + "\n"; }
                var idx = prompt("选择要删除的分组：\n" + list); if (!idx) return; idx = parseInt(idx) - 1;
                if (idx < 0 || idx >= data.length) return;
                if (!confirm("确定删除「" + data[idx].name + "」及其所有指令？")) return;
                data.splice(idx, 1); saveCmdData(data); renderCmd();
            } else if (action === "3") {
                if (data.length === 0) return;
                var list2 = ""; for (var di2 = 0; di2 < data.length; di2++) { list2 += (di2 + 1) + " = " + data[di2].name + "\n"; }
                var idx2 = prompt("选择要重命名的分组：\n" + list2); if (!idx2) return; idx2 = parseInt(idx2) - 1;
                if (idx2 < 0 || idx2 >= data.length) return;
                var nn = prompt("新名字：", data[idx2].name); if (!nn || !nn.trim()) return;
                data[idx2].name = nn.trim(); saveCmdData(data); renderCmd();
            }
        });
        cmdBarEl.appendChild(addBtn); cmdBarEl.appendChild(mgrBtn);
    }

    function renderCmdForm() {
        cmdListEl.style.display = "none"; cmdFormEl.style.display = "block";
        var data = loadCmdData();
        var isEdit = cmdEditing !== null;
        var editCmd = isEdit ? data[cmdEditing.gIdx].cmds[cmdEditing.cmdIdx] : null;
        if (data.length === 0) { data.push({ name: "常用指令", cmds: [] }); saveCmdData(data); }
        var grpOptions = "";
        for (var go = 0; go < data.length; go++) {
            var selFlag = "";
            if (isEdit && go === cmdEditing.gIdx) selFlag = " selected";
            else if (!isEdit && go === 0) selFlag = " selected";
            grpOptions += '<option value="' + go + '"' + selFlag + '>' + data[go].name + '</option>';
        }
        cmdFormEl.innerHTML =
            '<label class="cf-label">' + (isEdit ? "✏️ 编辑指令" : "➕ 新建指令") + '</label>' +
            '<label class="cf-label">指令名称</label>' +
            '<input type="text" class="cf-name" placeholder="例如：继续写" value="' + (editCmd ? editCmd.name.replace(/"/g, '&quot;') : '') + '" />' +
            '<label class="cf-label">指令内容（支持多行）</label>' +
            '<textarea class="cf-content" placeholder="例如：请继续写下去，{{char}}不要停...">' + (editCmd ? editCmd.content : '') + '</textarea>' +
            '<label class="cf-label">所属分组</label>' +
            '<select class="cf-group">' + grpOptions + '</select>' +
            '<label class="cf-label">点击行为</label>' +
            '<div class="cf-radio">' +
            '<label><input type="radio" name="cf-action" value="fill"' + (!editCmd || editCmd.action === "fill" ? " checked" : "") + ' /> ✏️ 填入输入框</label>' +
            '<label><input type="radio" name="cf-action" value="send"' + (editCmd && editCmd.action === "send" ? " checked" : "") + ' /> ⚡ 直接发送</label>' +
            '</div>' +
            '<div class="cf-var">💡 可用变量：{{user}} 你的名字 · {{char}} 角色名 · {{date}} 日期 · {{time}} 时间</div>';
        var formInputs = cmdFormEl.querySelectorAll("input, textarea, select");
        formInputs.forEach(function (inp) {
            inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
            inp.addEventListener("keyup", function (e) { e.stopPropagation(); });
            inp.addEventListener("keypress", function (e) { e.stopPropagation(); });
            inp.addEventListener("input", function (e) { e.stopPropagation(); });
        });
        cmdBarEl.innerHTML = "";
        var saveBtn = mk("button", "pbtn green", "✅ 保存"); saveBtn.style.cssText = "flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;";
        saveBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var nameVal = cmdFormEl.querySelector(".cf-name").value.trim();
            var contentVal = cmdFormEl.querySelector(".cf-content").value;
            var groupVal = parseInt(cmdFormEl.querySelector(".cf-group").value);
            var actionRadio = cmdFormEl.querySelector('input[name="cf-action"]:checked');
            var actionVal = actionRadio ? actionRadio.value : "fill";
            if (!nameVal) { cmdMsgEl.textContent = "⚠️ 请输入指令名称！"; cmdMsgEl.style.color = "#e74c3c"; return; }
            if (!contentVal.trim()) { cmdMsgEl.textContent = "⚠️ 请输入指令内容！"; cmdMsgEl.style.color = "#e74c3c"; return; }
            var freshData = loadCmdData();
            if (isEdit) {
                var oldGIdx = cmdEditing.gIdx; var oldCIdx = cmdEditing.cmdIdx;
                if (groupVal === oldGIdx) { freshData[oldGIdx].cmds[oldCIdx] = { name: nameVal, content: contentVal, action: actionVal }; }
                else { freshData[oldGIdx].cmds.splice(oldCIdx, 1); freshData[groupVal].cmds.push({ name: nameVal, content: contentVal, action: actionVal }); }
            } else { freshData[groupVal].cmds.push({ name: nameVal, content: contentVal, action: actionVal }); }
            saveCmdData(freshData); cmdFormMode = false; cmdEditing = null; renderCmd();
            cmdMsgEl.textContent = "✅ 已保存「" + nameVal + "」"; cmdMsgEl.style.color = "#27ae60";
        });
        var canBtn = mk("button", "pbtn gray", "✖ 取消"); canBtn.style.cssText = "flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;";
        canBtn.addEventListener("click", function (e) { e.stopPropagation(); cmdFormMode = false; cmdEditing = null; renderCmd(); });
        cmdBarEl.appendChild(saveBtn); cmdBarEl.appendChild(canBtn);
        if (isEdit) {
            var delBtn = mk("button", "pbtn red", "🗑 删除"); delBtn.style.cssText = "flex:1;min-width:55px;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;";
            delBtn.addEventListener("click", function (e) {
                e.stopPropagation(); if (!confirm("确定删除这条指令？")) return;
                var freshData = loadCmdData(); freshData[cmdEditing.gIdx].cmds.splice(cmdEditing.cmdIdx, 1); saveCmdData(freshData);
                cmdFormMode = false; cmdEditing = null; renderCmd(); cmdMsgEl.textContent = "✅ 已删除"; cmdMsgEl.style.color = "#27ae60";
            });
            cmdBarEl.appendChild(delBtn);
        }
    }

    /* ========== 皮肤系统 ========== */
    function getLastAIMessage() {
        try {
            var ctx = SillyTavern.getContext();
            var chat = ctx.chat;
            for (var i = chat.length - 1; i >= 0; i--) {
                if (!chat[i].is_user && chat[i].mes) return chat[i].mes;
            }
        } catch (e) {}
        return "";
    }

    function detectMoodSkin() {
        var sd = loadSkinData();
        if (sd.moodMode === "off" || !sd.moods || sd.moods.length === 0) return -2;
        var msg = getLastAIMessage();
        if (!msg) return -2;
        var matchedIdx = -1;
        if (sd.moodMode === "tag" || sd.moodMode === "both") {
            var tagMatch = msg.match(/\[mood:([^\]]+)\]/i);
            if (tagMatch) {
                var tagName = tagMatch[1].trim().toLowerCase();
                for (var ti = 0; ti < sd.moods.length; ti++) {
                    if (sd.moods[ti].name.toLowerCase() === tagName) { matchedIdx = ti; break; }
                }
            }
        }
        if (matchedIdx === -1 && (sd.moodMode === "keyword" || sd.moodMode === "both")) {
            var bestScore = 0;
            for (var ki = 0; ki < sd.moods.length; ki++) {
                var kws = sd.moods[ki].keywords || [];
                var score = 0;
                for (var kj = 0; kj < kws.length; kj++) {
                    if (kws[kj] && msg.indexOf(kws[kj]) !== -1) score++;
                }
                if (score > bestScore) { bestScore = score; matchedIdx = ki; }
            }
        }
        if (matchedIdx >= 0) return sd.moods[matchedIdx].skinIndex;
        return -2;
    }

    function applyFabSkin() {
        var sd = loadSkinData();
        var size = sd.size || 52;
        fab.style.width = size + "px";
        fab.style.height = size + "px";
        fab.style.lineHeight = size + "px";
        fab.className = "fab";
        if (sd.shape === "none") fab.classList.add("shape-none");
        else if (sd.shape === "rounded") fab.classList.add("shape-rounded");
        else fab.classList.add("shape-round");
        var moodSkin = detectMoodSkin();
        var skinIdx = (moodSkin !== -2) ? moodSkin : sd.activeIndex;
        if (skinIdx >= 0 && sd.skins[skinIdx]) {
            fab.innerHTML = '<img src="' + sd.skins[skinIdx].url + '" />';
        } else {
            fab.innerHTML = "&#x1F430;";
        }
    }

    function renderSkin() {
        var sd = loadSkinData();
        skinScroll.innerHTML = "";

        /* 大小滑块 */
        var sizeSection = document.createElement("div"); sizeSection.className = "skin-section";
        var sizeTitle = document.createElement("div"); sizeTitle.className = "skin-section-title"; sizeTitle.textContent = "📏 按钮大小";
        var sizeRow = document.createElement("div"); sizeRow.className = "skin-slider";
        var sizeRange = document.createElement("input"); sizeRange.type = "range"; sizeRange.min = "40"; sizeRange.max = "80"; sizeRange.value = String(sd.size || 52);
        var sizeVal = document.createElement("span"); sizeVal.className = "ss-val"; sizeVal.textContent = (sd.size || 52) + "px";
        sizeRange.addEventListener("input", function (e) {
            e.stopPropagation();
            var v = parseInt(sizeRange.value);
            sizeVal.textContent = v + "px";
            var d = loadSkinData(); d.size = v; saveSkinData(d); applyFabSkin();
        });
        sizeRow.appendChild(sizeRange); sizeRow.appendChild(sizeVal);
        sizeSection.appendChild(sizeTitle); sizeSection.appendChild(sizeRow);
        skinScroll.appendChild(sizeSection);

        /* 形状选择 */
        var shapeSection = document.createElement("div"); shapeSection.className = "skin-section";
        var shapeTitle = document.createElement("div"); shapeTitle.className = "skin-section-title"; shapeTitle.textContent = "🔲 按钮形状";
        var shapeRow = document.createElement("div"); shapeRow.className = "skin-shapes";
        var shapes = [
            { key: "round", label: "⭕ 圆形" },
            { key: "rounded", label: "🔲 圆角方形" },
            { key: "none", label: "✨ 无边框" }
        ];
        for (var si = 0; si < shapes.length; si++) {
            (function (s) {
                var opt = document.createElement("div"); opt.className = "ss-opt" + ((sd.shape || "none") === s.key ? " active" : "");
                opt.textContent = s.label;
                opt.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var d = loadSkinData(); d.shape = s.key; saveSkinData(d);
                    applyFabSkin(); renderSkin();
                });
                shapeRow.appendChild(opt);
            })(shapes[si]);
        }
        shapeSection.appendChild(shapeTitle); shapeSection.appendChild(shapeRow);
        skinScroll.appendChild(shapeSection);

        /* 皮肤列表 */
        var listSection = document.createElement("div"); listSection.className = "skin-section";
        var listTitle = document.createElement("div"); listTitle.className = "skin-section-title"; listTitle.textContent = "🎨 我的皮肤（点击切换）";
        listSection.appendChild(listTitle);

        var grid = document.createElement("div"); grid.className = "skin-grid";

        /* 默认兔兔 */
        var defCard = document.createElement("div"); defCard.className = "skin-card";
        var defImg = document.createElement("div"); defImg.className = "sc-img" + (sd.activeIndex === -1 ? " active" : "");
        defImg.innerHTML = '<span style="font-size:28px;">🐰</span>';
        var defName = document.createElement("div"); defName.className = "sc-name"; defName.textContent = "默认兔兔";
        defCard.appendChild(defImg); defCard.appendChild(defName);
        defCard.addEventListener("click", function (e) {
            e.stopPropagation();
            var d = loadSkinData(); d.activeIndex = -1; saveSkinData(d);
            applyFabSkin(); renderSkin();
        });
        grid.appendChild(defCard);

        /* 用户皮肤 */
        for (var ski = 0; ski < sd.skins.length; ski++) {
            (function (idx) {
                var skin = sd.skins[idx];
                var card = document.createElement("div"); card.className = "skin-card";
                var imgWrap = document.createElement("div"); imgWrap.className = "sc-img" + (sd.activeIndex === idx ? " active" : "");
                var img = document.createElement("img"); img.src = skin.url;
                img.onerror = function () { imgWrap.innerHTML = '<span style="font-size:10px;color:#ccc;">加载失败</span>'; };
                imgWrap.appendChild(img);
                var nameSpan = document.createElement("div"); nameSpan.className = "sc-name"; nameSpan.textContent = skin.name || ("皮肤" + (idx + 1));
                var delBtn = document.createElement("div"); delBtn.className = "sc-del"; delBtn.textContent = "×";
                delBtn.addEventListener("click", function (e) {
                    e.stopPropagation(); e.preventDefault();
                    if (!confirm("删除这个皮肤？")) return;
                    var d = loadSkinData(); d.skins.splice(idx, 1);
                    if (d.activeIndex === idx) d.activeIndex = -1;
                    else if (d.activeIndex > idx) d.activeIndex--;
                    saveSkinData(d); applyFabSkin(); renderSkin();
                });
                card.appendChild(imgWrap); card.appendChild(nameSpan); card.appendChild(delBtn);
                card.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var d = loadSkinData(); d.activeIndex = idx; saveSkinData(d);
                    applyFabSkin(); renderSkin();
                });
                grid.appendChild(card);
            })(ski);
        }
        listSection.appendChild(grid);
        skinScroll.appendChild(listSection);

        /* 添加皮肤按钮 */
        var addSection = document.createElement("div"); addSection.className = "skin-section";
        var addUrlBtn = mk("button", "pbtn pink", "🔗 从URL添加"); addUrlBtn.style.cssText = "width:100%;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;margin-bottom:8px;";
        addUrlBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var url = prompt("输入图片URL（支持PNG透明底）：");
            if (!url || !url.trim()) return;
            var name = prompt("给皮肤取个名字：", "我的皮肤") || "我的皮肤";
            var d = loadSkinData(); d.skins.push({ name: name.trim(), url: url.trim() }); d.activeIndex = d.skins.length - 1; saveSkinData(d);
            applyFabSkin(); renderSkin();
        });

        var addFileBtn = mk("button", "pbtn purple", "📁 从文件添加"); addFileBtn.style.cssText = "width:100%;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;margin-bottom:8px;";
        var fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.style.display = "none";
        fileInput.addEventListener("change", function (e) {
            e.stopPropagation();
            var file = fileInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                var dataUrl = ev.target.result;
                var name = prompt("给皮肤取个名字：", file.name.replace(/\.[^.]+$/, "")) || "我的皮肤";
                var d = loadSkinData(); d.skins.push({ name: name.trim(), url: dataUrl }); d.activeIndex = d.skins.length - 1; saveSkinData(d);
                applyFabSkin(); renderSkin();
            };
            reader.readAsDataURL(file);
            fileInput.value = "";
        });
        addFileBtn.addEventListener("click", function (e) { e.stopPropagation(); fileInput.click(); });

        addSection.appendChild(addUrlBtn); addSection.appendChild(addFileBtn); addSection.appendChild(fileInput);

        var tipDiv = document.createElement("div"); tipDiv.style.cssText = "font-size:10px;color:#aaa;line-height:1.6;padding:4px 0;";
        tipDiv.innerHTML = "💡 提示：<br/>· PNG透明底的抠图效果最好<br/>· 选「✨ 无边框」形状，图片会直接悬浮<br/>· 比如抠图狗狗PNG，看起来就是一只狗狗浮在屏幕上！";
        addSection.appendChild(tipDiv);

        skinScroll.appendChild(addSection);

        /* 情绪自动切换 */
        var moodSection = document.createElement("div"); moodSection.className = "skin-section";
        var moodTitle = document.createElement("div"); moodTitle.className = "skin-section-title"; moodTitle.textContent = "🎭 情绪自动切换";
        moodSection.appendChild(moodTitle);

        var modeRow = document.createElement("div"); modeRow.className = "skin-shapes";
        var modes = [
            { key: "off", label: "🚫 关闭" },
            { key: "keyword", label: "🔤 关键词" },
            { key: "tag", label: "🏷 AI标记" },
            { key: "both", label: "✨ 两者都用" }
        ];
        for (var mi = 0; mi < modes.length; mi++) {
            (function (m) {
                var opt = document.createElement("div"); opt.className = "ss-opt" + ((sd.moodMode || "off") === m.key ? " active" : "");
                opt.textContent = m.label;
                opt.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var d = loadSkinData(); d.moodMode = m.key; saveSkinData(d);
                    applyFabSkin(); renderSkin();
                });
                modeRow.appendChild(opt);
            })(modes[mi]);
        }
        moodSection.appendChild(modeRow);

        if (sd.moodMode !== "off") {
            var moodList = document.createElement("div"); moodList.style.cssText = "margin-top:10px;";
            if (sd.moods.length === 0) {
                var moodEmpty = document.createElement("div"); moodEmpty.style.cssText = "text-align:center;padding:15px;color:#ccc;font-size:11px;";
                moodEmpty.textContent = "还没有情绪，点下方添加";
                moodList.appendChild(moodEmpty);
            } else {
                for (var mdi = 0; mdi < sd.moods.length; mdi++) {
                    (function (mIdx) {
                        var mood = sd.moods[mIdx];
                        var mRow = document.createElement("div");
                        mRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid #f8f0f2;";

                        var mIcon = document.createElement("div");
                        mIcon.style.cssText = "width:32px;height:32px;border-radius:6px;overflow:hidden;background:#fafafa;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #eee;";
                        if (mood.skinIndex >= 0 && sd.skins[mood.skinIndex]) {
                            var mImg = document.createElement("img");
                            mImg.src = sd.skins[mood.skinIndex].url;
                            mImg.style.cssText = "width:100%;height:100%;object-fit:contain;";
                            mIcon.appendChild(mImg);
                        } else {
                            mIcon.innerHTML = '<span style="font-size:10px;color:#ccc;">无图</span>';
                        }

                        var mInfo = document.createElement("div"); mInfo.style.cssText = "flex:1;min-width:0;";
                        var mName = document.createElement("div"); mName.style.cssText = "font-size:11px;color:#c44569;font-weight:bold;"; mName.textContent = mood.name;
                        var mKw = document.createElement("div"); mKw.style.cssText = "font-size:9px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
                        mKw.textContent = "关键词：" + (mood.keywords || []).join("、");
                        mInfo.appendChild(mName); mInfo.appendChild(mKw);

                        var mEditBtn = document.createElement("button"); mEditBtn.style.cssText = "background:none;border:none;font-size:12px;cursor:pointer;padding:4px;flex-shrink:0;"; mEditBtn.textContent = "✏️";
                        mEditBtn.addEventListener("click", function (e) {
                            e.stopPropagation(); editMood(mIdx);
                        });

                        var mDelBtn = document.createElement("button"); mDelBtn.style.cssText = "background:none;border:none;font-size:12px;cursor:pointer;padding:4px;flex-shrink:0;"; mDelBtn.textContent = "🗑";
                        mDelBtn.addEventListener("click", function (e) {
                            e.stopPropagation();
                            if (!confirm("删除情绪「" + mood.name + "」？")) return;
                            var d = loadSkinData(); d.moods.splice(mIdx, 1); saveSkinData(d);
                            applyFabSkin(); renderSkin();
                        });

                        mRow.appendChild(mIcon); mRow.appendChild(mInfo); mRow.appendChild(mEditBtn); mRow.appendChild(mDelBtn);
                        moodList.appendChild(mRow);
                    })(mdi);
                }
            }
            moodSection.appendChild(moodList);

            var addMoodBtn = mk("button", "pbtn green", "➕ 添加情绪"); addMoodBtn.style.cssText = "width:100%;height:34px;border:none;border-radius:10px;font-size:12px;cursor:pointer;margin-top:8px;";
            addMoodBtn.addEventListener("click", function (e) { e.stopPropagation(); editMood(-1); });
            moodSection.appendChild(addMoodBtn);

            var moodTip = document.createElement("div"); moodTip.style.cssText = "font-size:9px;color:#aaa;line-height:1.6;padding:6px 0;";
            moodTip.innerHTML = "💡 关键词模式：扫描AI最新回复中的关键词<br/>🏷 AI标记模式：AI回复末尾带 [mood:情绪名]<br/>✨ 匹配到就自动换按钮图！";
            moodSection.appendChild(moodTip);
        }

        skinScroll.appendChild(moodSection);
    }

    function editMood(mIdx) {
        var sd = loadSkinData();
        var isEdit = mIdx >= 0;
        var mood = isEdit ? sd.moods[mIdx] : { name: "", skinIndex: -1, keywords: [] };

        skinScroll.innerHTML = "";
        var title = document.createElement("div"); title.className = "skin-section-title";
        title.textContent = isEdit ? "✏️ 编辑情绪" : "➕ 添加情绪";
        skinScroll.appendChild(title);

        var nameLabel = document.createElement("div"); nameLabel.style.cssText = "font-size:11px;color:#999;margin:8px 0 4px;"; nameLabel.textContent = "情绪名称（如：开心、难过、生气）";
        var nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.value = mood.name;
        nameInput.style.cssText = "width:100%;height:34px;border:1px solid #f0d0d8;border-radius:10px;padding:0 12px;font-size:13px;outline:none;background:#fffafc;color:#333;";
        nameInput.placeholder = "例如：开心";
        nameInput.addEventListener("keydown", function (e) { e.stopPropagation(); });
        nameInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
        nameInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
        nameInput.addEventListener("input", function (e) { e.stopPropagation(); });
        skinScroll.appendChild(nameLabel); skinScroll.appendChild(nameInput);

        var kwLabel = document.createElement("div"); kwLabel.style.cssText = "font-size:11px;color:#999;margin:8px 0 4px;"; kwLabel.textContent = "关键词（用逗号分隔）";
        var kwInput = document.createElement("input"); kwInput.type = "text"; kwInput.value = (mood.keywords || []).join("，");
        kwInput.style.cssText = "width:100%;height:34px;border:1px solid #f0d0d8;border-radius:10px;padding:0 12px;font-size:13px;outline:none;background:#fffafc;color:#333;";
        kwInput.placeholder = "例如：笑，开心，哈哈，高兴";
        kwInput.addEventListener("keydown", function (e) { e.stopPropagation(); });
        kwInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
        kwInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
        kwInput.addEventListener("input", function (e) { e.stopPropagation(); });
        skinScroll.appendChild(kwLabel); skinScroll.appendChild(kwInput);

        var imgLabel = document.createElement("div"); imgLabel.style.cssText = "font-size:11px;color:#999;margin:8px 0 4px;"; imgLabel.textContent = "绑定皮肤（点击选择）";
        skinScroll.appendChild(imgLabel);

        var selIdx = mood.skinIndex;
        var imgGrid = document.createElement("div"); imgGrid.className = "skin-grid";

        function renderImgSelect() {
            imgGrid.innerHTML = "";
            var freshSd = loadSkinData();
            for (var ii = 0; ii < freshSd.skins.length; ii++) {
                (function (idx) {
                    var card = document.createElement("div"); card.className = "skin-card";
                    var imgWrap = document.createElement("div"); imgWrap.className = "sc-img" + (selIdx === idx ? " active" : "");
                    var img = document.createElement("img"); img.src = freshSd.skins[idx].url;
                    imgWrap.appendChild(img);
                    var nm = document.createElement("div"); nm.className = "sc-name"; nm.textContent = freshSd.skins[idx].name || ("皮肤" + (idx + 1));
                    card.appendChild(imgWrap); card.appendChild(nm);
                    card.addEventListener("click", function (e) {
                        e.stopPropagation(); selIdx = idx; renderImgSelect();
                    });
                    imgGrid.appendChild(card);
                })(ii);
            }
            if (freshSd.skins.length === 0) {
                imgGrid.innerHTML = '<div style="color:#ccc;font-size:11px;padding:10px;">还没有皮肤，请先在上方添加皮肤图片</div>';
            }
        }
        renderImgSelect();
        skinScroll.appendChild(imgGrid);

        var btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;gap:8px;margin-top:14px;";
        var saveBtn = mk("button", "pbtn green", "✅ 保存"); saveBtn.style.cssText = "flex:1;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;";
        saveBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var nm = nameInput.value.trim();
            if (!nm) { alert("请输入情绪名称！"); return; }
            var kws = kwInput.value.split(/[,，、\s]+/).filter(function (x) { return x.trim(); });
            var d = loadSkinData();
            var newMood = { name: nm, skinIndex: selIdx, keywords: kws };
            if (isEdit) { d.moods[mIdx] = newMood; }
            else { d.moods.push(newMood); }
            saveSkinData(d); applyFabSkin(); renderSkin();
        });
        var canBtn = mk("button", "pbtn gray", "✖ 取消"); canBtn.style.cssText = "flex:1;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;";
        canBtn.addEventListener("click", function (e) { e.stopPropagation(); renderSkin(); });
        btnRow.appendChild(saveBtn); btnRow.appendChild(canBtn);
        skinScroll.appendChild(btnRow);
    }

    /* ========== 面板事件和定位 ========== */
    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });

    var posX = 100;
    var posY = 300;

    function posPanel() {
        var sd = loadSkinData();
        var fabSize = sd.size || 52;
        var pw = Math.min(window.innerWidth * 0.9, 420);
        var ph = Math.min(window.innerHeight * 0.75, 650);
        var gap = 10;
        var left = posX + fabSize / 2 - pw / 2;
        if (left < 5) left = 5;
        if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top;
        if (posY - gap - ph > 5) { top = posY - gap - ph; }
        else { top = posY + fabSize + gap; if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph; }
        panel.style.left = left + "px"; panel.style.top = top + "px"; panel.style.width = pw + "px"; panel.style.height = ph + "px";
    }

    function openP(text) {
        eTag.textContent = getEngine().name; renderHistory();
        if (text) { sInput.value = text; tabEls[0].click(); doSearch(text); }
        if (!text && !hasSearch) tipEl.style.display = "flex";
        posPanel(); panel.style.display = "flex"; overlay.style.display = "block"; panelOpen = true;
    }
    function closeP() { panel.style.display = "none"; overlay.style.display = "none"; panelOpen = false; gsDrop.style.display = "none"; ePop.style.display = "none"; }
    function toggleP() {
        var sel = window.getSelection(); var text = sel ? sel.toString().trim() : "";
        if (panelOpen) { if (text) { sInput.value = text; tabEls[0].click(); doSearch(text); } else closeP(); }
        else openP(text);
    }

    var dragging = false;
    var hasMoved = false;
    var startX = 0;
    var startY = 0;

    function moveTo(x, y) {
        var sd = loadSkinData();
        var fabSize = sd.size || 52;
        var mx = window.innerWidth - fabSize; var my = window.innerHeight - fabSize;
        if (x < 0) x = 0; if (y < 0) y = 0; if (x > mx) x = mx; if (y > my) y = my;
        posX = x; posY = y; fab.style.left = x + "px"; fab.style.top = y + "px";
        if (panelOpen) posPanel();
    }

    fab.addEventListener("touchstart", function (e) {
        e.preventDefault(); e.stopImmediatePropagation(); dragging = true; hasMoved = false;
        var t = e.touches[0]; startX = t.clientX - posX; startY = t.clientY - posY;
    }, { passive: false });
    fab.addEventListener("touchmove", function (e) {
        e.preventDefault(); e.stopImmediatePropagation(); if (!dragging) return; hasMoved = true;
        var t = e.touches[0]; moveTo(t.clientX - startX, t.clientY - startY);
    }, { passive: false });
    fab.addEventListener("touchend", function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var wasDrag = dragging; var wasMoved = hasMoved; dragging = false; hasMoved = false;
        if (wasDrag && !wasMoved) setTimeout(function () { toggleP(); }, 50);
        if (wasDrag && wasMoved) { localStorage.setItem("bnyPosX", String(posX)); localStorage.setItem("bnyPosY", String(posY)); }
    }, { passive: false });
    fab.addEventListener("mousedown", function (e) {
        e.preventDefault(); e.stopImmediatePropagation(); dragging = true; hasMoved = false;
        startX = e.clientX - posX; startY = e.clientY - posY;
    });
    document.addEventListener("mousemove", function (e) { if (!dragging) return; hasMoved = true; moveTo(e.clientX - startX, e.clientY - startY); });
    document.addEventListener("mouseup", function () {
        if (!dragging) return; var wasMoved = hasMoved; dragging = false; hasMoved = false;
        if (!wasMoved) toggleP(); else { localStorage.setItem("bnyPosX", String(posX)); localStorage.setItem("bnyPosY", String(posY)); }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX"); var sy = localStorage.getItem("bnyPosY");
        if (sx !== null && sy !== null) { posX = parseInt(sx); posY = parseInt(sy); }
        applyFabSkin();
        moveTo(posX, posY); fab.style.display = "flex";
    }
    function hideFab() { fab.style.display = "none"; closeP(); }

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") { $("#bny-toggle").prop("checked", true); showFab(); $("#bny-status").text("Bunny is visible!"); }
    $("#bny-toggle").on("change", function () {
        var on = $(this).prop("checked");
        if (on) { showFab(); $("#bny-status").text("Bunny is visible!"); }
        else { hideFab(); $("#bny-status").text("Bunny is hidden"); }
        localStorage.setItem("bnyShow", on ? "1" : "0");
    });

    function onPresetChange() {
        currentGroup = null; editingGroup = null; selectMode = false; manageMode = false; selected = {};
        if (panelOpen) renderAll();
    }
try {
        var moodCheckTimer = null;
        var chatObserver = new MutationObserver(function () {
            if (moodCheckTimer) clearTimeout(moodCheckTimer);
            moodCheckTimer = setTimeout(function () {
                var sd = loadSkinData();
                if (sd.moodMode !== "off") applyFabSkin();
            }, 800);
        });
        var waitChat = setInterval(function () {
            var chatEl = document.getElementById("chat");
            if (chatEl) {
                clearInterval(waitChat);
                chatObserver.observe(chatEl, { childList: true, subtree: true });
            }
        }, 1000);
    } catch (e) {}
    var presetEl1 = document.getElementById("settings_preset_openai");
    var presetEl2 = document.getElementById("settings_preset");
    if (presetEl1) presetEl1.addEventListener("change", onPresetChange);
    if (presetEl2) presetEl2.addEventListener("change", onPresetChange);
});
