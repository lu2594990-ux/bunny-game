jQuery(() => {
    var getContainer = function () { return $(document.getElementById("extensions_settings")); };
    var GRP_KEY = "bunnyPresetGroups";

    getContainer().append(
        '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
            '<b>🐰 Bunny Toolbox</b>' +
            '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">' +
                '<input type="checkbox" id="bny-toggle" /><span>Show Bunny</span>' +
            '</label>' +
            '<div style="padding:5px 0;">' +
                '<label style="font-size:12px;color:#888;">搜索引擎</label>' +
                '<select id="bny-engine" style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:13px;">' +
                    '<option value="google">Google</option>' +
                    '<option value="baidu">百度</option>' +
                    '<option value="bing">必应</option>' +
                    '<option value="quark">夸克</option>' +
                '</select>' +
            '</div>' +
            '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
        '</div></div>'
    );

    var engines = {
        google: {
            name: "Google",
            search: function (q) { return "https://www.google.com/search?igu=1&q=" + encodeURIComponent(q); },
            fallback: function (q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); }
        },
        baidu: {
            name: "百度",
            search: function (q) { return "https://www.baidu.com/s?wd=" + encodeURIComponent(q); },
            fallback: function (q) { return "https://www.baidu.com/s?wd=" + encodeURIComponent(q); }
        },
        bing: {
            name: "必应",
            search: function (q) { return "https://www.bing.com/search?q=" + encodeURIComponent(q); },
            fallback: function (q) { return "https://www.bing.com/search?q=" + encodeURIComponent(q); }
        },
        quark: {
            name: "夸克",
            search: function (q) { return "https://quark.sm.cn/s?q=" + encodeURIComponent(q); },
            fallback: function (q) { return "https://quark.sm.cn/s?q=" + encodeURIComponent(q); }
        }
    };
    function getEngine() {
        var k = localStorage.getItem("bnyEngine") || "google";
        return engines[k] || engines.google;
    }
    $("#bny-engine").val(localStorage.getItem("bnyEngine") || "google");
    $("#bny-engine").on("change", function () { localStorage.setItem("bnyEngine", $(this).val()); });

    function getActiveOrder() {
        try {
            var ctx = SillyTavern.getContext();
            var ccs = ctx.chatCompletionSettings;
            if (!ccs || !ccs.prompt_order) return [];
            var po = ccs.prompt_order;
            for (var i = 0; i < po.length; i++) {
                if (po[i].character_id === 100000) return po[i].order;
            }
            return po[0] ? po[0].order : [];
        } catch (e) { return []; }
    }
    function getPrompts() {
        try {
            var ctx = SillyTavern.getContext();
            var ccs = ctx.chatCompletionSettings;
            return (ccs && ccs.prompts) ? ccs.prompts : [];
        } catch (e) { return []; }
    }
    function isEnabled(identifier) {
        var order = getActiveOrder();
        for (var i = 0; i < order.length; i++) {
            if (order[i].identifier === identifier) return order[i].enabled;
        }
        return false;
    }
    function setEnabled(identifier, val) {
        var order = getActiveOrder();
        for (var i = 0; i < order.length; i++) {
            if (order[i].identifier === identifier) {
                order[i].enabled = val;
                break;
            }
        }
        try { SillyTavern.getContext().saveSettingsDebounced(); } catch (e) {}
    }
    function loadGroups() {
        try { return JSON.parse(localStorage.getItem(GRP_KEY)) || []; } catch (e) { return []; }
    }
    function saveGroups(g) { localStorage.setItem(GRP_KEY, JSON.stringify(g)); }

    var host = document.createElement("div");
    host.id = "bny-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    var styleEl = document.createElement("style");
    styleEl.textContent =
        "*{box-sizing:border-box;margin:0;padding:0;}" +
        "::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#e0c0c8;border-radius:4px;}" +
        ".fab{position:fixed;width:52px;height:52px;font-size:24px;line-height:52px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;border:2px solid rgba(255,255,255,.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform .15s;z-index:10;}" +
        ".fab:active{transform:scale(.9);}" +
        ".pnl{position:fixed;width:90vw;max-width:420px;height:75vh;max-height:650px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}" +
        ".tabs{display:flex;background:#fff;border-bottom:1px solid #fde2e8;flex-shrink:0;}" +
        ".tab{flex:1;padding:10px 0;text-align:center;font-size:13px;cursor:pointer;color:#aaa;border-bottom:2px solid transparent;transition:.2s;}" +
        ".tab.on{color:#c44569;border-bottom-color:#c44569;font-weight:bold;}" +
        ".tc{flex:1;display:none;flex-direction:column;overflow:hidden;}.tc.on{display:flex;}" +
        ".sh{display:flex;align-items:center;padding:8px 10px;background:#fff;border-bottom:1px solid #fde2e8;gap:5px;flex-shrink:0;}" +
        ".sh input{flex:1;height:34px;border:1px solid #f0d0d8;border-radius:20px;padding:0 12px;font-size:13px;outline:none;background:#fffafc;color:#333;min-width:0;}.sh input:focus{border-color:#ff6b9d;}" +
        ".btn{height:34px;padding:0 10px;border:none;border-radius:20px;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0;}" +
        ".bgo{background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;}" +
        ".bcl{background:#f0e0e4;color:#c44569;font-size:11px;padding:0 8px;}" +
        ".etag{font-size:10px;color:#c44569;background:#fde2e8;padding:2px 8px;border-radius:10px;flex-shrink:0;}" +
        ".sb{flex:1;position:relative;background:#fff;overflow:hidden;}" +
        ".sb iframe{width:100%;height:100%;border:none;}" +
        ".fb{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.95);border:1px solid #fde2e8;padding:6px 16px;border-radius:20px;font-size:11px;color:#c44569;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.1);text-decoration:none;z-index:1;}" +
        ".tip{display:flex;align-items:center;justify-content:center;height:100%;color:#ccc;font-size:13px;text-align:center;padding:20px;line-height:1.8;}" +
        ".pc{flex:1;display:flex;flex-direction:column;overflow:hidden;}" +
        ".pf{display:flex;align-items:center;padding:8px 10px;background:#fff;border-bottom:1px solid #fde2e8;gap:5px;flex-shrink:0;}" +
        ".pf input{flex:1;height:32px;border:1px solid #f0d0d8;border-radius:20px;padding:0 12px;font-size:12px;outline:none;background:#fffafc;}" +
        ".pf input:focus{border-color:#ff6b9d;}" +
        ".gl{padding:6px 10px;background:#f9f0f3;border-bottom:1px solid #fde2e8;flex-shrink:0;overflow-x:auto;white-space:nowrap;display:flex;gap:6px;align-items:center;min-height:42px;}" +
        ".gc{display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #fde2e8;border-radius:16px;padding:4px 8px;font-size:11px;flex-shrink:0;}" +
        ".gc .gn{color:#c44569;font-weight:bold;max-width:80px;overflow:hidden;text-overflow:ellipsis;}" +
        ".gc .ga{background:#ff6b9d;color:#fff;border:none;border-radius:10px;padding:2px 8px;font-size:10px;cursor:pointer;}" +
        ".gc .gd{background:none;border:none;color:#ccc;font-size:13px;cursor:pointer;padding:0 2px;}" +
        ".gc .gd:hover{color:#e74c3c;}" +
        ".gc .goff{background:#f0e0e4;color:#c44569;border:none;border-radius:10px;padding:2px 6px;font-size:10px;cursor:pointer;}" +
        ".pl{flex:1;overflow-y:auto;padding:4px 0;}" +
        ".pi{display:flex;align-items:center;padding:6px 12px;gap:8px;border-bottom:1px solid #f8f0f2;}" +
        ".pi:active{background:#fff5f8;}" +
        ".pi .pn{flex:1;font-size:12px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".pi .pt{position:relative;width:40px;height:22px;background:#ddd;border-radius:11px;cursor:pointer;transition:.2s;flex-shrink:0;}" +
        ".pi .pt.on{background:#ff6b9d;}" +
        ".pi .pt::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s;}" +
        ".pi .pt.on::after{left:20px;}" +
        ".pi .pc2{width:18px;height:18px;border:2px solid #ddd;border-radius:4px;cursor:pointer;flex-shrink:0;display:none;position:relative;}" +
        ".pi .pc2.on{background:#ff6b9d;border-color:#ff6b9d;}" +
        ".pi .pc2.on::after{content:'✓';position:absolute;top:-2px;left:2px;color:#fff;font-size:12px;}" +
        ".pbar{display:flex;gap:4px;padding:6px 10px;background:#fff;border-top:1px solid #fde2e8;flex-shrink:0;flex-wrap:wrap;}" +
        ".pbar .pbtn{flex:1;min-width:0;height:32px;border:none;border-radius:10px;font-size:11px;cursor:pointer;color:#fff;}" +
        ".pbar .pbtn.save{background:linear-gradient(135deg,#a855f7,#7c3aed);}" +
        ".pbar .pbtn.sel{background:linear-gradient(135deg,#ff6b9d,#c44569);}" +
        ".pbar .pbtn.can{background:#f0e0e4;color:#c44569;}" +
        ".pmsg{text-align:center;padding:4px;font-size:11px;color:#888;flex-shrink:0;min-height:20px;}";
    shadow.appendChild(styleEl);

    var fab = document.createElement("div");
    fab.className = "fab";
    fab.innerHTML = "&#x1F430;";
    shadow.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "pnl";
    panel.innerHTML =
        '<div class="tabs">' +
            '<div class="tab on" data-t="search">🔍 搜索</div>' +
            '<div class="tab" data-t="preset">📋 预设</div>' +
        '</div>' +
        '<div class="tc on" data-t="search">' +
            '<div class="sh">' +
                '<span class="etag"></span>' +
                '<input type="text" class="si" placeholder="搜索或输入网址..."/>' +
                '<button class="btn bgo sbtn">搜索</button>' +
                '<button class="btn bcl cbtn">清空</button>' +
            '</div>' +
            '<div class="sb">' +
                '<div class="tip">选中文字后点🐰自动搜索<br/>输入网址可直接访问</div>' +
                '<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer" style="display:none;"></iframe>' +'<a class="fb" target="_blank" rel="noopener" style="display:none;">加载不出来？点这里 ↗</a>' +
            '</div>' +
        '</div>' +
        '<div class="tc" data-t="preset">' +
            '<div class="pc">' +
                '<div class="pf">' +
                    '<input type="text" class="pfin" placeholder="🔍 筛选条目名称..."/>' +
                    '<button class="btn bcl refbtn">刷新</button>' +
                '</div>' +
                '<div class="gl"></div>' +
                '<div class="pl"></div>' +
                '<div class="pmsg"></div>' +
                '<div class="pbar">' +
                    '<button class="pbtn sel selbtn">☑ 多选模式</button>' +
                    '<button class="pbtn save savbtn">💾 存为组</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    shadow.appendChild(panel);

    var tabEls = panel.querySelectorAll(".tab");
    var tcEls = panel.querySelectorAll(".tc");
    tabEls.forEach(function (t) {
        t.addEventListener("click", function (e) {
            e.stopPropagation();
            var v = this.getAttribute("data-t");
            tabEls.forEach(function (x) { x.classList.remove("on"); });
            tcEls.forEach(function (x) { x.classList.remove("on"); });
            this.classList.add("on");
            panel.querySelector('.tc[data-t="' + v + '"]').classList.add("on");
            if (v === "preset") renderPresets();
        });
    });

    var sInput = panel.querySelector(".si");
    var sBtnEl = panel.querySelector(".sbtn");
    var cBtnEl = panel.querySelector(".cbtn");
    var iframe = panel.querySelector("iframe");
    var fbLink = panel.querySelector(".fb");
    var tipEl = panel.querySelector(".tip");
    var eTag = panel.querySelector(".etag");
    var pfInput = panel.querySelector(".pfin");
    var refBtn = panel.querySelector(".refbtn");
    var glEl = panel.querySelector(".gl");
    var plEl = panel.querySelector(".pl");
    var pmsgEl = panel.querySelector(".pmsg");
    var selBtn = panel.querySelector(".selbtn");
    var savBtn = panel.querySelector(".savbtn");

    var panelOpen = false, hasSearch = false;
    var selectMode = false;
    var selected = {};

    function isUrl(s) {
        s = s.trim().toLowerCase();
        return s.indexOf("http://") === 0 || s.indexOf("https://") === 0|| /^[a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,}/.test(s);
    }
    function toUrl(s) {
        s = s.trim();
        if (s.indexOf("http") !== 0) s = "https://" + s;
        return s;
    }
    function doSearch(q) {
        if (!q.trim()) return;
        q = q.trim();
        var eng = getEngine();
        eTag.textContent = eng.name;
        if (isUrl(q)) {
            iframe.src = toUrl(q);
            fbLink.href = toUrl(q);
        } else {
            iframe.src = eng.search(q);
            fbLink.href = eng.fallback(q);
        }
        iframe.style.display = "block";
        tipEl.style.display = "none";
        fbLink.style.display = "block";
        hasSearch = true;
    }
    function clearS() {
        iframe.src = "";
        iframe.style.display = "none";
        tipEl.style.display = "flex";
        fbLink.style.display = "none";
        sInput.value = "";
        hasSearch = false;
    }sBtnEl.addEventListener("click", function (e) { e.stopPropagation(); doSearch(sInput.value); });
    cBtnEl.addEventListener("click", function (e) { e.stopPropagation(); clearS(); });
    sInput.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") doSearch(sInput.value); });
    sInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    sInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    sInput.addEventListener("input", function (e) { e.stopPropagation(); });
    function renderGroups() {
        var groups = loadGroups();
        glEl.innerHTML = "";
        if (groups.length === 0) {
            glEl.innerHTML = '<span style="color:#ccc;font-size:11px;">还没有分组，多选条目后点💾存为组</span>';
            return;
        }
        for (var i = 0; i < groups.length; i++) {
            (function (idx) {
                var g = groups[idx];
                var gc = document.createElement("div");
                gc.className = "gc";
                var gn = document.createElement("span");
                gn.className = "gn";
                gn.textContent = g.name;
                gn.title = g.name + " (" + g.ids.length + "条)";
                var ga = document.createElement("button");
                ga.className = "ga";
                ga.textContent = "开";
                ga.addEventListener("click", function (e) {
                    e.stopPropagation();
                    for (var j = 0; j < g.ids.length; j++) setEnabled(g.ids[j], true);
                    renderPresets();
                    pmsgEl.textContent = "✅ 已开启「" + g.name + "」" + g.ids.length + "条";pmsgEl.style.color = "#27ae60";
                });
                var goff = document.createElement("button");
                goff.className = "goff";
                goff.textContent = "关";
                goff.addEventListener("click", function (e) {
                    e.stopPropagation();
                    for (var j = 0; j < g.ids.length; j++) setEnabled(g.ids[j], false);
                    renderPresets();
                    pmsgEl.textContent = "❌ 已关闭「" + g.name + "」" + g.ids.length + "条";
                    pmsgEl.style.color = "#e74c3c";
                });
                var gd = document.createElement("button");
                gd.className = "gd";
                gd.textContent = "×";
                gd.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var all = loadGroups();
                    all.splice(idx, 1);
                    saveGroups(all);
                    renderGroups();
                    pmsgEl.textContent = "🗑 已删除「" + g.name + "」";
                    pmsgEl.style.color = "#888";
                });
                gc.appendChild(gn);
                gc.appendChild(ga);
                gc.appendChild(goff);
                gc.appendChild(gd);
                glEl.appendChild(gc);
            })(i);
        }
    }

    function renderPresets() {
        var prompts = getPrompts();
        var filter = pfInput.value.trim().toLowerCase();
        plEl.innerHTML = "";

        var shown = 0;
        for (var i = 0; i < prompts.length; i++) {
            (function (p) {
                if (p.marker) return;
                var name = p.name || p.identifier;
                if (filter && name.toLowerCase().indexOf(filter) === -1) return;
                var id = p.identifier;
                var en = isEnabled(id);

                var row = document.createElement("div");
                row.className = "pi";

                var nameEl = document.createElement("div");
                nameEl.className = "pn";
                nameEl.textContent = name;

                var tog = document.createElement("div");
                tog.className = "pt" + (en ? " on" : "");
                tog.addEventListener("click", function (e) {
                    e.stopPropagation();
                    if (selectMode) return;
                    var now = !isEnabled(id);
                    setEnabled(id, now);
                    if (now) tog.classList.add("on");
                    else tog.classList.remove("on");
                    pmsgEl.textContent = (now ? "✅ 开启" : "❌ 关闭") + " " + name;
                    pmsgEl.style.color = now ? "#27ae60" : "#e74c3c";
                });

                var chk = document.createElement("div");
                chk.className = "pc2" + (selected[id] ? " on" : "");
                chk.addEventListener("click", function (e) {
                    e.stopPropagation();
                    selected[id] = !selected[id];
                    if (selected[id]) chk.classList.add("on");
                    else chk.classList.remove("on");
                    var cnt = 0;
                    for (var k in selected) { if (selected[k]) cnt++; }
                    pmsgEl.textContent = "已选 " + cnt + " 条";
                    pmsgEl.style.color = "#c44569";
                });

                if (selectMode) {
                    chk.style.display = "block";
                    tog.style.display = "none";
                } else {
                    chk.style.display = "none";
                    tog.style.display = "block";
                }

                row.appendChild(nameEl);
                row.appendChild(tog);
                row.appendChild(chk);
                plEl.appendChild(row);
                shown++;
            })(prompts[i]);
        }
        if (shown === 0) {
            plEl.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:12px;">没有找到匹配的条目</div>';
        }renderGroups();
    }

    pfInput.addEventListener("input", function (e) { e.stopPropagation(); renderPresets(); });
    pfInput.addEventListener("keydown", function (e) { e.stopPropagation(); });
    pfInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    pfInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    refBtn.addEventListener("click", function (e) { e.stopPropagation(); renderPresets(); pmsgEl.textContent = "🔄 已刷新"; pmsgEl.style.color = "#888"; });

    selBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        selectMode = !selectMode;
        if (selectMode) {
            selected = {};
            selBtn.textContent = "✖ 取消多选";
            selBtn.style.background = "#f0e0e4";
            selBtn.style.color = "#c44569";
            savBtn.style.display = "block";
        } else {
            selected = {};
            selBtn.textContent = "☑ 多选模式";
            selBtn.style.background = "";
            selBtn.style.color = "";
            savBtn.style.display = "block";
        }
        renderPresets();
    });

    savBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var ids = [];
        for (var k in selected) { if (selected[k]) ids.push(k); }
        if (ids.length === 0) {
            pmsgEl.textContent = "⚠️ 请先勾选条目！";
            pmsgEl.style.color = "#e74c3c";
            return;
        }
        var nameInput = prompt("给这个分组取个名字：");
        if (!nameInput || !nameInput.trim()) return;
        var groups = loadGroups();
        groups.push({ name: nameInput.trim(), ids: ids });
        saveGroups(groups);
        selected = {};
        selectMode = false;
        selBtn.textContent = "☑ 多选模式";
        selBtn.style.background = "";
        selBtn.style.color = "";
        renderPresets();
        pmsgEl.textContent = "✅ 已保存「" + nameInput.trim() + "」" + ids.length + "条";
        pmsgEl.style.color = "#27ae60";
    });

    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("click", function (e) { e.stopPropagation(); });panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });

    var posX = 100, posY = 300;
    function posPanel() {
        var pw = Math.min(window.innerWidth * 0.9, 420);
        var ph = Math.min(window.innerHeight * 0.75, 650);
        var gap = 10;
        var left = posX + 26- pw / 2;
        if (left < 5) left = 5;
        if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top;
        if (posY - gap - ph >5) {
            top = posY - gap - ph;
        } else {
            top = posY + 52+ gap;
            if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph;
        }
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.width = pw + "px";
        panel.style.height = ph + "px";}
    function openP(text) {
        eTag.textContent = getEngine().name;
        if (text) {
            sInput.value = text;
            tabEls[0].click();
            doSearch(text);
        }
        if (!text && !hasSearch) tipEl.style.display = "flex";
        posPanel();
        panel.style.display = "flex";
        panelOpen = true;
    }
    function closeP() {
        panel.style.display = "none";
        panelOpen = false;
    }
    function toggleP() {
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : "";
        if (panelOpen) {
            if (text) {
                sInput.value = text;
                tabEls[0].click();
                doSearch(text);
            } else {
                closeP();
            }
        } else {
            openP(text);
        }
    }

    var dragging = false, hasMoved = false, startX = 0, startY = 0;
    function moveTo(x, y) {
        var mx = window.innerWidth - 52;
        var my = window.innerHeight - 52;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > mx) x = mx;
        if (y > my) y = my;
        posX = x;
        posY = y;
        fab.style.left = x + "px";
        fab.style.top = y + "px";
        if (panelOpen) posPanel();
    }

    fab.addEventListener("touchstart", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragging = true;
        hasMoved = false;
        var t = e.touches[0];
        startX = t.clientX - posX;
        startY = t.clientY - posY;
    }, { passive: false });

    fab.addEventListener("touchmove", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!dragging) return;
        hasMoved = true;
        var t = e.touches[0];
        moveTo(t.clientX - startX, t.clientY - startY);
    }, { passive: false });

    fab.addEventListener("touchend", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var wasDragging = dragging;
        var wasMoved = hasMoved;
        dragging = false;
        hasMoved = false;
        if (wasDragging && !wasMoved) {
            setTimeout(function () { toggleP(); }, 50);
        }
        if (wasDragging && wasMoved) {
            localStorage.setItem("bnyPosX", String(posX));
            localStorage.setItem("bnyPosY", String(posY));
        }
    }, { passive: false });

    fab.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragging = true;
        hasMoved = false;
        startX = e.clientX - posX;
        startY = e.clientY - posY;
    });

    document.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        hasMoved = true;
        moveTo(e.clientX - startX, e.clientY - startY);
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) return;
        var wasMoved = hasMoved;
        dragging = false;
        hasMoved = false;
        if (!wasMoved) toggleP();
        else {
            localStorage.setItem("bnyPosX", String(posX));
            localStorage.setItem("bnyPosY", String(posY));
        }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX");
        var sy = localStorage.getItem("bnyPosY");
        if (sx !== null && sy !== null) {
            posX = parseInt(sx);
            posY = parseInt(sy);
        }
        moveTo(posX, posY);fab.style.display = "block";
    }
    function hideFab() {
        fab.style.display = "none";
        closeP();
    }

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") {
        $("#bny-toggle").prop("checked", true);
        showFab();
        $("#bny-status").text("Bunny is visible!");
    }
    $("#bny-toggle").on("change", function () {
        var on = $(this).prop("checked");
        if (on) {
            showFab();
            $("#bny-status").text("Bunny is visible!");
        } else {
            hideFab();
            $("#bny-status").text("Bunny is hidden");
        }
        localStorage.setItem("bnyShow", on ? "1" : "0");
    });
});
