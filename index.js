jQuery(() => {
    var getContainer = function () { return $(document.getElementById("extensions_settings")); };
    var defaultKillPrompt = '不禁、宛如、仿佛、微微、轻轻、竟然、不由自主、眼眸、嗤笑、轻哼、蹙眉、低眸、敛眸、氤氲';
    var defaultStylePrompt = '余华的冷峻写实风格';
    var killPrefix = '你是一位资深中文母语文学编辑。请遵循下方的写作规则和禁词列表，对正文进行全文风格重写——在保留原文全部情节、人物行为、对话内容、情感走向与篇幅的前提下，将全文语言重新组织，使其具备中文母语作家的语感与文学质感，远离AI生成的翻译腔。直接输出重写后的文本，不要任何解释。\n\n禁词列表：';
    var stylePrefix = '你是一位资深中文母语文学编辑。用户会提供一段目标风格的描述，可能是某位作家的名字、一段详细的写作手法拆解、或者一组风格关键词。无论用户以何种形式描述，你都需要深入理解其核心风格特征，并从以下维度全方位渗透进文本：\n\n1.【用词质感】根据目标风格选择匹配的词汇温度。华丽或朴素、冷峻或温柔、书面或口语化、古典或当代\n2.【句式节奏】匹配目标风格的断句习惯与节奏感。长句绵延还是短句斩截、松弛还是紧绷、呼吸感如何\n3.【修辞与意象】匹配目标风格偏好的手法。比喻的取向、通感的用法、留白的分寸、意象的选取\n4.【叙述姿态】匹配目标风格中叙述者的站位。冷眼旁观还是跳出来评点、克制还是浓烈、是录像机还是说书人\n5.【情绪埋藏方式】匹配目标风格处理情感的手法。直抒胸臆还是藏在反话底下、表面薄凉底下是否有心疼、情绪外露还是压在冰面之下\n6.【感官细节偏好】匹配目标风格对五感的调用方式。偏视觉还是触觉、细节是密铺还是点到即止\n\n严格要求：\n- 保持原文全部情节、角色、对话、情感走向完全不变\n- 不添加原文没有的情节，不删减任何内容\n- 篇幅保持与原文相当\n- 不是在原文表面贴几个风格标签，而是用目标风格的骨骼和呼吸重新长出这段文字\n- 直接输出润色后的文本，不要任何解释说明\n\n以下是用户指定的目标风格：\n';
    var CFG_KEY = "bunnyToolboxCfg";
    var CHUNK_SIZE = 800;

    function buildUrl(u) {
        if (!u) return "";
        u = u.trim().replace(/\/+$/, "");
        if (!/\/chat\/completions$/i.test(u)) {
            if (!/\/v1$/i.test(u)) u += "/v1";
            u += "/chat/completions";
        }
        return u;
    }

    function loadS() {
        var s = localStorage.getItem(CFG_KEY);
        if (s) try { return JSON.parse(s); } catch (e) {}
        var oldKeys = ["bnyS7", "bnyS6", "bnyS5", "bnyS4"];
        for (var i = 0; i < oldKeys.length; i++) {
            var o = localStorage.getItem(oldKeys[i]);
            if (o) try {
                var parsed = JSON.parse(o);
                localStorage.setItem(CFG_KEY, o);
                return parsed;
            } catch (e) {}
        }
        return null;
    }

    function getS() {
        var url = ($("#bny-api-url").val() || "").trim();
        var key = ($("#bny-api-key").val() || "").trim();
        var model = ($("#bny-api-model").val() || "").trim();
        var kp = $("#bny-kill-prompt").val() || "";
        var sp = $("#bny-style-prompt").val() || "";
        var temp = parseFloat($("#bny-temp").val());
        var topp = parseFloat($("#bny-topp").val());
        if (isNaN(temp)) temp = 0.7;
        if (isNaN(topp)) topp = 1.0;
        if (!url || !key) {
            var saved = loadS();
            if (saved) {
                if (!url && saved.url) url = saved.url;
                if (!key && saved.key) key = saved.key;
                if (!model && saved.model) model = saved.model;}
        }
        return { url: url, key: key, model: model || "gpt-4o-mini", temp: temp, topp: topp, killPrompt: kp, stylePrompt: sp };
    }

    function saveS(silent) {
        var o = getS();
        localStorage.setItem(CFG_KEY, JSON.stringify(o));
        if (!silent) $("#bny-status").text("✅ 已保存！").css("color", "#27ae60");
        return o;
    }

    function splitChunks(text) {
        var paragraphs = text.split(/\n/);
        var chunks = [];
        var current = "";
        for (var i = 0; i < paragraphs.length; i++) {
            var p = paragraphs[i];
            if (current.length + p.length + 1 > CHUNK_SIZE && current.length > 0) {
                chunks.push(current);
                current = p;
            } else {
                current += (current ? "\n" : "") + p;
            }
        }
        if (current) chunks.push(current);
        if (chunks.length === 0) chunks.push(text);
        return chunks;
    }

    function parseKillWords(killPrompt) {
        return killPrompt.split(/[、,，\n]+/)
            .map(function (w) { return w.trim(); })
            .filter(function (w) { return w.length > 0; });
    }

    function findResidual(text, words) {
        var found = [];
        for (var i = 0; i < words.length; i++) {
            if (text.indexOf(words[i]) !== -1) found.push(words[i]);
        }
        return found;
    }

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
            '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;"/>' +
            '<div style="font-weight:bold;font-size:13px;color:#c44569;padding:4px 0;">🔧 API设置</div>' +
            '<div style="padding:3px 0;"><label style="font-size:12px;color:#888;">API地址（填到/v1即可）</label>' +
                '<input type="text" id="bny-api-url" placeholder="https://api.openai.com/v1" style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:11px;"/></div>' +
            '<div style="padding:3px 0;"><label style="font-size:12px;color:#888;">API Key</label>' +
                '<input type="password" id="bny-api-key" placeholder="sk-..." style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:12px;"/></div>' +
            '<div style="padding:3px 0;"><label style="font-size:12px;color:#888;">模型名称</label>' +
                '<input type="text" id="bny-api-model" placeholder="gpt-4o-mini" style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:12px;"/></div>' +
            '<div style="padding:3px 0;"><label style="font-size:12px;color:#888;">Temperature:<span id="bny-temp-val">0.7</span></label>' +
                '<input type="range" id="bny-temp" min="0" max="2" step="0.1" value="0.7" style="width:100%;"/></div>' +
            '<div style="padding:3px 0;"><label style="font-size:12px;color:#888;">Top P: <span id="bny-topp-val">1.0</span></label>' +
                '<input type="range" id="bny-topp" min="0" max="1" step="0.05" value="1.0" style="width:100%;"/></div>' +
            '<button id="bny-test-api" style="margin-top:4px;padding:5px 16px;border-radius:8px;border:1px solid #ddd;background:#f8f8f8;color:#666;font-size:12px;cursor:pointer;width:100%;">🔌 测试API连接</button>' +
            '<div id="bny-test-result" style="padding:4px 0;font-size:11px;color:#888;word-break:break-all;"></div>' +
            '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;"/>' +
            '<div style="font-weight:bold;font-size:13px;color:#c44569;padding:4px 0;">✨杀八股禁词列表</div>' +
            '<textarea id="bny-kill-prompt" rows="3" style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:12px;resize:vertical;font-family:inherit;"></textarea>' +
            '<div style="font-weight:bold;font-size:13px;color:#c44569;padding:4px 0;margin-top:4px;">🎨 目标文风</div>' +
            '<textarea id="bny-style-prompt" rows="3" style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #ddd;font-size:12px;resize:vertical;font-family:inherit;"></textarea>' +
            '<button id="bny-save" style="margin-top:6px;padding:6px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff6b9d,#c44569);color:white;font-size:12px;cursor:pointer;width:100%;">💾 保存所有设置</button>' +
            '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
        '</div></div>'
    );

    var prev = loadS();
    if (prev) {
        $("#bny-api-url").val(prev.url || "");
        $("#bny-api-key").val(prev.key || "");
        $("#bny-api-model").val(prev.model || "gpt-4o-mini");
        $("#bny-temp").val(prev.temp != null ? prev.temp : 0.7);
        $("#bny-temp-val").text(prev.temp != null ? prev.temp : 0.7);
        $("#bny-topp").val(prev.topp != null ? prev.topp : 1.0);
        $("#bny-topp-val").text(prev.topp != null ? prev.topp : 1.0);
        $("#bny-kill-prompt").val(prev.killPrompt || defaultKillPrompt);
        $("#bny-style-prompt").val(prev.stylePrompt || defaultStylePrompt);
    } else {
        $("#bny-kill-prompt").val(defaultKillPrompt);
        $("#bny-style-prompt").val(defaultStylePrompt);
    }

    $("#bny-temp").on("input", function () { $("#bny-temp-val").text($(this).val()); saveS(true); });
    $("#bny-topp").on("input", function () { $("#bny-topp-val").text($(this).val()); saveS(true); });
    $("#bny-api-url, #bny-api-key, #bny-api-model").on("change", function () { saveS(true); });
    $("#bny-kill-prompt, #bny-style-prompt").on("change", function () { saveS(true); });
    $("#bny-save").on("click", function () { saveS(false); });

    $("#bny-test-api").on("click", function () {
        var st = getS();
        var r = $("#bny-test-result");
        if (!st.url) { r.html('<span style="color:#e74c3c;">❌ 请填写API地址</span>'); return; }
        if (!st.key) { r.html('<span style="color:#e74c3c;">❌ 请填写API Key</span>'); return; }
        var fullUrl = buildUrl(st.url);
        r.html('<span style="color:#888;">🔄 测试中... → ' + fullUrl + '</span>');
        fetch(fullUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + st.key },
            body: JSON.stringify({ model: st.model, messages: [{ role: "user", content: "Hi, reply only: OK" }], max_tokens: 10 })
        }).then(function (resp) {
            if (!resp.ok) return resp.text().then(function (t) {
                var d = t;
                try { var j = JSON.parse(t); d = j.error ? (j.error.message || JSON.stringify(j.error)) : t; } catch (e) {}
                throw new Error("HTTP " + resp.status + ": " + d);
            });
            return resp.json();
        }).then(function (data) {
            var reply = "";
            if (data.choices && data.choices[0]) reply = data.choices[0].message.content;
            r.html('<span style="color:#27ae60;">✅ 连接成功！回复: ' + reply + '</span>');
            saveS(true);
        }).catch(function (err) {
            r.html('<span style="color:#e74c3c;">❌ ' + err.message + '</span>');});
    });

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
        ".pnl{position:fixed;width:90vw;max-width:400px;height:70vh;max-height:600px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}" +
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
        ".pc{flex:1;display:flex;flex-direction:column;padding:12px;gap:8px;overflow-y:auto;}" +
        ".sl{font-size:11px;color:#c44569;font-weight:bold;}" +
        ".pv{background:#f9f0f3;border:1px solid #fde2e8;border-radius:10px;padding:10px;font-size:12px;color:#666;min-height:40px;overflow-y:auto;line-height:1.6;white-space:pre-wrap;word-break:break-word;}" +
        ".pv.empty{color:#ccc;font-style:italic;}" +
        ".br{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;}" +
        ".ab{flex:1;min-width:0;height:40px;border:none;border-radius:12px;color:#fff;font-size:13px;font-weight:bold;cursor:pointer;transition:transform .1s,opacity .2s;}" +
        ".ab:active{transform:scale(.97);}.ab:disabled{opacity:.5;cursor:not-allowed;}" +
        ".ab.k{background:linear-gradient(135deg,#ff6b9d,#c44569);}" +
        ".ab.s{background:linear-gradient(135deg,#6b9dff,#4569c4);}" +
        ".ab.b{background:linear-gradient(135deg,#a855f7,#7c3aed);flex-basis:100%;}" +
        ".st{font-size:12px;color:#888;text-align:center;padding:2px;min-height:18px;word-break:break-all;}" +
        ".st.err{color:#e74c3c;}.st.ok{color:#27ae60;}" +
        ".rs{display:none;}" +
        ".rb{background:#f0faf0;border:1px solid #d0e8d0;border-radius:10px;padding:10px;font-size:12px;color:#333;min-height:40px;overflow-y:auto;line-height:1.6;white-space:pre-wrap;word-break:break-word;}" +
        ".sw-row{display:none;gap:6px;margin-top:4px;}" +
        ".sw-btn{flex:1;height:34px;border-radius:10px;font-size:12px;cursor:pointer;border:1px solid #fde2e8;background:#fff;color:#c44569;}" +
        ".sw-btn.active{background:#c44569;color:#fff;border-color:#c44569;}" +
        ".ti{font-size:10px;color:#bbb;text-align:right;}" +
        ".ed{background:#fff5f5;border:1px solid #fdd;border-radius:8px;padding:8px;font-size:10px;color:#c0392b;max-height:80px;overflow-y:auto;word-break:break-all;margin-top:4px;display:none;}";
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
            '<div class="tab" data-t="polish">✨ 润色</div>' +
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
        '<div class="tc" data-t="polish">' +
            '<div class="pc">' +
                '<div class="sl">📄 当前正文：</div>' +
                '<div class="pv empty">点击下方按钮抓取最新回复...</div>' +
                '<div class="ti"></div>' +
                '<button class="btn bgo grab" style="width:100%;margin:2px 0;">📋 抓取最新回复</button>' +
                '<div class="br">' +
                    '<button class="ab k" disabled>✨杀八股</button>' +
                    '<button class="ab s" disabled>🎨 文风</button>' +
                '</div>' +
                '<div class="br">' +
                    '<button class="ab b" disabled>⚡ 杀八股+文风 一次搞定</button>' +
                '</div>' +
                '<div class="st"></div>' +
                '<div class="ed"></div>' +
                '<div class="rs"><div class="sl">✅ 润色结果：</div><div class="rb"></div></div>' +
                '<div class="sw-row">' +
                    '<button class="sw-btn" data-v="orig">↩ 查看原文</button>' +
                    '<button class="sw-btn active" data-v="mod">↪ 应用修改版</button>' +
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
        });
    });

    var sInput = panel.querySelector(".si");
    var sBtnEl = panel.querySelector(".sbtn");
    var cBtnEl = panel.querySelector(".cbtn");
    var iframe = panel.querySelector("iframe");
    var fbLink = panel.querySelector(".fb");
    var tipEl = panel.querySelector(".tip");
    var eTag = panel.querySelector(".etag");
    var pvEl = panel.querySelector(".pv");
    var tiEl = panel.querySelector(".ti");
    var grabBtnEl = panel.querySelector(".grab");
    var killBtn = panel.querySelector(".ab.k");
    var styleBtn = panel.querySelector(".ab.s");
    var bothBtn = panel.querySelector(".ab.b");
    var stEl = panel.querySelector(".st");
    var edEl = panel.querySelector(".ed");
    var rsEl = panel.querySelector(".rs");
    var rbEl = panel.querySelector(".rb");
    var swRow = panel.querySelector(".sw-row");
    var swBtns = panel.querySelectorAll(".sw-btn");

    var panelOpen = false, hasSearch = false;
    var gContent = null, gIndex = null, gFull = null;
    var origContent = null, origFull = null, modContent = null, modFull = null;
    var showingMod = true;

    function isUrl(s) {
        s = s.trim().toLowerCase();
        return s.indexOf("http://") === 0 || s.indexOf("https://") === 0|| /^[a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,}/.test(s);
    }
    function toUrl(s) {
        s = s.trim();
        if (s.indexOf("http") !== 0) s = "https://" + s;
        return s;
    }
    function roughTk(s) { return Math.ceil(s.length / 2); }
    function exCont(t) {
        var m = t.match(/<content>([\s\S]*?)<\/content>/i);
        return m ? m[1].trim() : null;
    }
    function repCont(t, n) {
        return t.replace(/<content>[\s\S]*?<\/content>/i, "<content>" + n + "</content>");
    }
    function getLastBot() {
        try {
            var ctx = SillyTavern.getContext();
            var c = ctx.chat;
            for (var i = c.length - 1; i >= 0; i--) {
                if (!c[i].is_user && !c[i].is_system) return { index: i, text: c[i].mes };
            }
        } catch (e) {}
        return null;
    }
    function setAB(d) {
        killBtn.disabled = d;
        styleBtn.disabled = d;
        bothBtn.disabled = d;
    }
    function writeMes(index, text) {
        try {
            var ctx = SillyTavern.getContext();
            ctx.chat[index].mes = text;
            var d = document.querySelector('#chat .mes[mesid="' + index + '"] .mes_text');
            if (d) {
                if (typeof messageFormatting === "function") {
                    d.innerHTML = messageFormatting(text, ctx.name2, false, false, index);
                } else {
                    d.innerHTML = text.replace(/\n/g, "<br>");
                }
            }
            ctx.saveChat();
        } catch (ex) {
            console.error("[Bunny]", ex);
        }
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
            iframe.src = eng.search(q);fbLink.href = eng.fallback(q);
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
    }

    grabBtnEl.addEventListener("click", function (e) {
        e.stopPropagation();
        var msg = getLastBot();
        if (!msg) {
            pvEl.textContent = "❌ 没有找到AI回复";
            pvEl.classList.add("empty");
            setAB(true);
            return;
        }
        gFull = msg.text;
        gIndex = msg.index;
        origFull = msg.text;
        modContent = null;
        modFull = null;
        showingMod = true;
        var content = exCont(msg.text);
        gContent = content || msg.text;
        origContent = gContent;
        var chunks = splitChunks(gContent);
        var tag = content ? "✅ 已提取<content>标签内容" : "⚠️ 未找到<content>标签，使用全文";
        tag += "（" + gContent.length + "字，" + chunks.length + "段）";
        pvEl.textContent = tag + "\n\n" + gContent;
        pvEl.classList.remove("empty");
        tiEl.textContent = "≈ " + roughTk(gContent) + " tokens";
        setAB(false);
        stEl.textContent = "";
        stEl.className = "st";
        edEl.style.display = "none";
        rsEl.style.display = "none";
        swRow.style.display = "none";
    });

    function callApi(sysPrompt, userText) {
        var st = getS();
        var fullUrl = buildUrl(st.url);
        return fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json","Authorization": "Bearer " + st.key
            },
            body: JSON.stringify({
                model: st.model,
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: userText }
                ],
                temperature: st.temp,
                top_p: st.topp,
                max_tokens: 32000
            })
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (t) {
                var d = t;
                try {
                    var j = JSON.parse(t);
                    d = j.error ? (j.error.message || JSON.stringify(j.error)) : t;
                } catch (e) {}
                throw new Error("HTTP " + res.status + ": " + d);
            });
            return res.json();
        }).then(function (data) {
            if (data.choices && data.choices[0]) return data.choices[0].message.content;
            if (data.content && data.content[0]) return data.content[0].text;
            throw new Error("返回格式异常");
        });
    }

    function applyResult(newContent) {
        modContent = newContent;
        var hasTag = /<content>[\s\S]*?<\/content>/i.test(origFull);
        modFull = hasTag ? repCont(origFull, newContent) : newContent;
        writeMes(gIndex, modFull);
        gFull = modFull;
        gContent = newContent;
        showingMod = true;
        pvEl.textContent = newContent;
        tiEl.textContent = "≈ " + roughTk(newContent) + " tokens";
        rbEl.textContent = newContent;
        rsEl.style.display = "block";
        swRow.style.display = "flex";
        swBtns.forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-v") === "mod");
        });
    }

    swBtns.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var v = this.getAttribute("data-v");
            swBtns.forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            if (v === "orig") {
                writeMes(gIndex, origFull);
                gFull = origFull;
                gContent = origContent;
                showingMod = false;
                pvEl.textContent = origContent;
                tiEl.textContent = "≈ " + roughTk(origContent) + " tokens";
                stEl.textContent = "↩ 已切换到原文";
                stEl.className = "st";} else {
                if (!modFull) return;
                writeMes(gIndex, modFull);
                gFull = modFull;
                gContent = modContent;
                showingMod = true;
                pvEl.textContent = modContent;
                tiEl.textContent = "≈ " + roughTk(modContent) + " tokens";
                stEl.textContent = "↪ 已切换到修改版";
                stEl.className = "st ok";
            }
        });btn.addEventListener("touchstart", function (e) { e.stopPropagation(); });
        btn.addEventListener("touchend", function (e) { e.stopPropagation(); });
    });

    function doPolish(mode) {
        var st = getS();
        if (!st.url || !st.key) {
            stEl.textContent = "⚠️ 请先填写API地址和Key！";
            stEl.className = "st err";
            return;
        }
        if (!gContent) {
            stEl.textContent = "⚠️ 请先抓取回复！";
            stEl.className = "st err";
            return;
        }
        setAB(true);
        edEl.style.display = "none";

        if (mode === "both") {
            var stylePromptFull = stylePrefix + st.stylePrompt;
            var killPromptFull = killPrefix + st.killPrompt;
            var killWords = parseKillWords(st.killPrompt);
            var chunks = splitChunks(gContent);
            var total = chunks.length;
            var styleResults = [];

            function styleNext(idx) {
                if (idx >= total) {
                    var styledText = styleResults.join("\n");
                    stEl.textContent = "🔄 第二步：杀八股...";
                    var chunks2 = splitChunks(styledText);
                    var total2 = chunks2.length;
                    var killResults = [];

                    function killNext(idx2) {
                        if (idx2 >= total2) {
                            var finalText = killResults.join("\n");
                            applyResult(finalText);
                            var remaining = findResidual(finalText, killWords);
                            if (remaining.length > 0) {
                                stEl.textContent = "✅ 文风+杀八股完成！残留: " + remaining.join("、");
                            } else {
                                stEl.textContent = "✅ 文风+杀八股完成！无残留禁词🎉";
                            }
                            stEl.className = "st ok";
                            setAB(false);
                            return;
                        }
                        var p2 = total2 >1 ? " 第" + (idx2 + 1) + "/" + total2 + "段" : "";
                        stEl.textContent = "🔄杀八股" + p2 + "...";
                        callApi(killPromptFull, chunks2[idx2]).then(function (r) {
                            var residual = findResidual(r, killWords);
                            if (residual.length > 0) {
                                stEl.textContent = "🔄" + p2 + " 修正残留: " + residual.join("、");
                                var fixPrompt = "以下文本仍然包含这些禁词：" + residual.join("、") + "\n请将它们替换为更自然的中文表达。其余文字保持完全不变。直接输出修改后的全文，不要任何解释。";
                                return callApi(fixPrompt, r).then(function (r2) {
                                    killResults.push(r2);
                                    killNext(idx2 + 1);
                                });
                            }
                            killResults.push(r);
                            killNext(idx2 + 1);
                        }).catch(function (e) {
                            stEl.textContent = "❌ 杀八股 第" + (idx2 + 1) + "段失败";
                            stEl.className = "st err";
                            edEl.textContent = e.message || String(e);
                            edEl.style.display = "block";
                            setAB(false);
                        });
                    }
                    killNext(0);
                    return;
                }
                var p1 = total > 1 ? " 第" + (idx + 1) + "/" + total + "段" : "";
                stEl.textContent = "🔄 第一步：文风润色" + p1 + "...";
                callApi(stylePromptFull, chunks[idx]).then(function (r) {
                    styleResults.push(r);
                    styleNext(idx + 1);
                }).catch(function (e) {
                    stEl.textContent = "❌ 文风润色 第" + (idx + 1) + "段失败";
                    stEl.className = "st err";
                    edEl.textContent = e.message || String(e);
                    edEl.style.display = "block";
                    setAB(false);
                });
            }
            styleNext(0);
            return;
        }

        var prompt, label;
        if (mode === "kill") {
            prompt = killPrefix + st.killPrompt;
            label = "杀八股";
        } else {
            prompt = stylePrefix + st.stylePrompt;
            label = "文风润色";
        }

        var killWords = (mode === "kill") ? parseKillWords(st.killPrompt) : [];
        var chunks = splitChunks(gContent);
        var total = chunks.length;
        var results = [];

        function processNext(idx) {
            if (idx >= total) {
                var finalText = results.join("\n");
                applyResult(finalText);
                if (killWords.length > 0) {
                    var remaining = findResidual(finalText, killWords);
                    if (remaining.length > 0) {
                        stEl.textContent = "✅ " + label + "完成！残留: " + remaining.join("、");
                    } else {
                        stEl.textContent = "✅ " + label + "完成！无残留禁词🎉";
                    }
                } else {
                    stEl.textContent = "✅ " + label + "完成！";
                }
                stEl.className = "st ok";
                setAB(false);
                return;
            }

            var progress = total > 1 ? " 第" + (idx + 1) + "/" + total + "段" : "";
            stEl.textContent = "🔄 " + label + progress + "...";
            stEl.className = "st";

            callApi(prompt, chunks[idx]).then(function (r) {
                if (killWords.length > 0) {
                    var residual = findResidual(r, killWords);
                    if (residual.length > 0) {
                        stEl.textContent = "🔄" + progress + " 修正残留: " + residual.join("、");
                        var fixPrompt = "以下文本仍然包含这些禁词：" + residual.join("、") + "\n请将它们替换为更自然的中文表达。其余文字保持完全不变。直接输出修改后的全文，不要任何解释。";
                        return callApi(fixPrompt, r).then(function (r2) {
                            results.push(r2);
                            processNext(idx + 1);
                        });
                    }
                }
                results.push(r);
                processNext(idx + 1);
            }).catch(function (e) {
                var msg = e.message || String(e);
                stEl.textContent = "❌ " + label + " 第" + (idx + 1) + "段失败";
                stEl.className = "st err";
                edEl.textContent = msg;
                edEl.style.display = "block";
                setAB(false);
            });
        }

        processNext(0);
    }

    killBtn.addEventListener("click", function (e) { e.stopPropagation(); doPolish("kill"); });
    styleBtn.addEventListener("click", function (e) { e.stopPropagation(); doPolish("style"); });
    bothBtn.addEventListener("click", function (e) { e.stopPropagation(); doPolish("both"); });sBtnEl.addEventListener("click", function (e) { e.stopPropagation(); doSearch(sInput.value); });
    cBtnEl.addEventListener("click", function (e) { e.stopPropagation(); clearS(); });
    sInput.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") doSearch(sInput.value); });
    sInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    sInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    sInput.addEventListener("input", function (e) { e.stopPropagation(); });

    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });

    [killBtn, styleBtn, bothBtn, grabBtnEl].forEach(function (b) {
        b.addEventListener("touchstart", function (e) { e.stopPropagation(); });
        b.addEventListener("touchend", function (e) { e.stopPropagation(); });
    });

    var posX = 100, posY = 300;
    function posPanel() {
        var pw = Math.min(window.innerWidth * 0.9, 400);
        var ph = Math.min(window.innerHeight * 0.7, 600);
        var gap = 10;
        var left = posX + 26 - pw / 2;
        if (left < 5) left = 5;
        if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top;
        if (posY - gap - ph > 5) {
            top = posY - gap - ph;
        } else {
            top = posY + 52+ gap;
            if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph;
        }
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.width = pw + "px";
        panel.style.height = ph + "px";
    }
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
        startY = t.clientY - posY;}, { passive: false });

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
        moveTo(posX, posY);
        fab.style.display = "block";
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
    
