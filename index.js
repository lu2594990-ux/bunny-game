jQuery(() => {
    var getContainer = function () {
        return $(document.getElementById("extensions_settings"));
    };

    getContainer().append(
        '<div class="inline-drawer">' +
            '<div class="inline-drawer-toggle inline-drawer-header">' +
                '<b>Bunny Game</b>' +
                '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
            '</div>' +
            '<div class="inline-drawer-content">' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">' +
                    '<input type="checkbox" id="bny-toggle" />' +
                    '<span>Show Bunny</span>' +
                '</label>' +
                '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
            '</div>' +
        '</div>'
    );

    var fab = document.createElement("div");
    fab.id = "bny-fab";
    fab.innerHTML = "&#x1F430;";
    document.body.appendChild(fab);

    var fabStyle = fab.style;
    fabStyle.setProperty("position", "fixed", "important");
    fabStyle.setProperty("bottom", "140px", "important");
    fabStyle.setProperty("right", "10px", "important");
    fabStyle.setProperty("z-index", "2147483647", "important");
    fabStyle.setProperty("width", "52px", "important");
    fabStyle.setProperty("height", "52px", "important");
    fabStyle.setProperty("font-size", "24px", "important");
    fabStyle.setProperty("line-height", "52px", "important");
    fabStyle.setProperty("text-align", "center", "important");
    fabStyle.setProperty("border-radius", "50%", "important");
    fabStyle.setProperty("background", "linear-gradient(135deg, #ff6b9d, #c44569)", "important");
    fabStyle.setProperty("color", "white", "important");
    fabStyle.setProperty("border", "2px solid rgba(255,255,255,0.3)", "important");
    fabStyle.setProperty("cursor", "pointer", "important");
    fabStyle.setProperty("display", "none", "important");
    fabStyle.setProperty("touch-action", "none", "important");
    fabStyle.setProperty("user-select", "none", "important");
    fabStyle.setProperty("box-shadow", "0 4px 15px rgba(255,107,157,0.5)", "important");
    fabStyle.setProperty("filter", "none", "important");
    fabStyle.setProperty("opacity", "1", "important");
    fabStyle.setProperty("visibility", "visible", "important");
    fabStyle.setProperty("pointer-events", "auto", "important");
    fabStyle.setProperty("padding", "0", "important");
    fabStyle.setProperty("margin", "0", "important");

    var dragging = false;
    var hasMoved = false;
    var startX = 0;
    var startY = 0;
    var fabX = 0;
    var fabY = 0;

    function getPos() {
        var rect = fab.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
    }

    function setPos(x, y) {
        var maxX = window.innerWidth - fab.offsetWidth;
        var maxY = window.innerHeight - fab.offsetHeight;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;

        fabStyle.setProperty("left", x + "px", "important");
        fabStyle.setProperty("top", y + "px", "important");fabStyle.setProperty("right", "auto", "important");
        fabStyle.setProperty("bottom", "auto", "important");
    }

    function snapToEdge(x, y) {
        var w = window.innerWidth;
        var fw = fab.offsetWidth;
        var targetX = (x + fw / 2 < w / 2) ? 6 : w - fw - 6;
        var currentX = x;
        var currentY = y;
        var steps = 12;
        var step = 0;

        function animate() {
            step++;
            var t = step / steps;
            t = t * (2 - t);
            var nowX = currentX + (targetX - currentX) * t;
            setPos(nowX, currentY);
            if (step < steps) {
                requestAnimationFrame(animate);
            } else {
                localStorage.setItem("bnyPosX", targetX);
                localStorage.setItem("bnyPosY", currentY);
            }
        }
        animate();
    }

    fab.addEventListener("touchstart", function (e) {
        dragging = true;
        hasMoved = false;
        var touch = e.touches[0];
        var pos = getPos();
        startX = touch.clientX - pos.x;
        startY = touch.clientY - pos.y;
        fabX = pos.x;
        fabY = pos.y;
    }, { passive: true });

    fab.addEventListener("touchmove", function (e) {
        if (!dragging) return;
        e.preventDefault();
        hasMoved = true;
        var touch = e.touches[0];
        var nx = touch.clientX - startX;
        var ny = touch.clientY - startY;
        setPos(nx, ny);
        fabX = nx;
        fabY = ny;
    }, { passive: false });

    fab.addEventListener("touchend", function () {
        if (!dragging) return;
        dragging = false;
        if (hasMoved) {
            snapToEdge(fabX, fabY);
        }
    });

    fab.addEventListener("mousedown", function (e) {
        dragging = true;
        hasMoved = false;
        var pos = getPos();
        startX = e.clientX - pos.x;
        startY = e.clientY - pos.y;
        fabX = pos.x;
        fabY = pos.y;
    });

    document.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        hasMoved = true;
        var nx = e.clientX - startX;
        var ny = e.clientY - startY;
        setPos(nx, ny);
        fabX = nx;
        fabY = ny;
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        if (hasMoved) {
            snapToEdge(fabX, fabY);
        }
    });

    fab.addEventListener("click", function () {
        if (!hasMoved) {
            alert("Bunny is here! It works!");
        }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX");
        var sy = localStorage.getItem("bnyPosY");
        if (sx !== null && sy !== null) {
            fabStyle.setProperty("left", sx + "px", "important");
            fabStyle.setProperty("top", sy + "px", "important");
            fabStyle.setProperty("right", "auto", "important");
            fabStyle.setProperty("bottom", "auto", "important");
        }
        fabStyle.setProperty("display", "flex", "important");
    }

    function hideFab() {
        fabStyle.setProperty("display", "none", "important");
    }

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") {
        $("#bny-toggle").prop("checked", true);showFab();
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
