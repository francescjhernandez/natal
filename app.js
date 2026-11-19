"use strict";
/* ============================================================
   INFORMADOR DE CAICÓ · CIDADE EDUCADORA (RN, BRASIL)
   Front-end trilíngue (pt-BR / es / en), com voz (Web Speech API),
   letra ampliável, PWA instalável e registro automático das
   perguntas no Worker da Cloudflare.
   ============================================================ */

/* >>> URL do Worker da Cloudflare <<< */
const API_URL = "https://caico.francesc-j-hernandez.workers.dev/api/chat";
/* Em local (wrangler dev): http://127.0.0.1:8787/api/chat */

/* ---------- Idiomas ---------- */
const I18N = {
  pt:{nom:"Português (BR)", nomAuto:"Português", bcp:"pt-BR", bcpVeu:"pt-BR",
      lema:"A oferta educacional de Caicó em 3 idiomas — porque aprender ao longo da vida é um direito.",
      benvinguda:"Sou o Informador de Caicó, Cidade Educadora (RN).🎓\nPergunte-me sobre a oferta educacional da cidade: creches, escolas municipais e estaduais, IFRN Campus Caicó, cursos técnicos, Educação de Jovens e Adultos (EJA), bolsas e transporte escolar… Escreva ou use o botão de voz.",
      ph:"Escreva sua pergunta…", envia:"Enviar", micro:"Ditar por voz",
      escolta:"Ouvir", para:"Parar", pensant:"Pensando…",
      errConn:"Não foi possível contatar o servidor. Sua pergunta fica guardada e será enviada quando a conexão voltar.",
      instal:"Instalar app", fontMenys:"Diminuir a letra", fontMes:"Aumentar a letra", fontReset:"Letra normal",
      escoltant:"Estou ouvindo… fale agora", cues:"Pergunta guardada para envio posterior"},
  es:{nom:"Español", nomAuto:"Español", bcp:"es", bcpVeu:"es",
      lema:"La oferta educativa de Caicó en 3 idiomas — porque aprender a lo largo de la vida es un derecho.",
      benvinguda:"Soy el Informador de Caicó, Ciudad Educadora (RN).🎓\nPregúntame sobre la oferta educativa de la ciudad: guarderías, escuelas municipales y estatales, IFRN Campus Caicó, cursos técnicos, Educación de Jóvenes y Adultos, becas y transporte escolar… Escribe o usa el botón de voz.",
      ph:"Escribe tu pregunta…", envia:"Enviar", micro:"Dictar por voz",
      escolta:"Escuchar", para:"Parar", pensant:"Pensando…",
      errConn:"No he podido contactar con el servidor. Tu pregunta queda guardada y se enviará cuando vuelva la conexión.",
      instal:"Instalar app", fontMenys:"Reducir la letra", fontMes:"Ampliar la letra", fontReset:"Letra normal",
      escoltant:"Te escucho… habla ahora", cues:"Pregunta guardada para enviar más tarde"},
  en:{nom:"English", nomAuto:"English", bcp:"en", bcpVeu:"en-US",
      lema:"Caicó's education offer in 3 languages — because lifelong learning is a right.",
      benvinguda:"I am the Caicó Informer, Educating City (RN, Brazil).🎓\nAsk me about the city's education offer: nursery schools, municipal and state schools, IFRN Caicó Campus, technical courses, youth and adult education (EJA), scholarships and school transport… Type or use the voice button.",
      ph:"Type your question…", envia:"Send", micro:"Dictate by voice",
      escolta:"Listen", para:"Stop", pensant:"Thinking…",
      errConn:"Could not reach the server. Your question is saved and will be sent when the connection returns.",
      instal:"Install app", fontMenys:"Smaller text", fontMes:"Larger text", fontReset:"Normal text",
      escoltant:"Listening… speak now", cues:"Question saved to send later"}
};

/* ---------- Estado ---------- */
let lang = localStorage.getItem("informador-idioma") || "pt";
if (!I18N[lang]) lang = "pt";
const MARGE_FONT = [90, 100, 112, 125, 140];
let nivellFont = parseInt(localStorage.getItem("informador-font") || "1", 10);
if (isNaN(nivellFont)) nivellFont = 1;
let reconeixement = null, escoltant = false;
let sessio = localStorage.getItem("informador-sessio");
if (!sessio) {
  sessio = (crypto.randomUUID) ? crypto.randomUUID()
          : "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("informador-sessio", sessio);
}

const $ = (id) => document.getElementById(id);
const xat = $("xat"), entrada = $("entrada"), estat = $("estat");

/* ---------- Inicialização ---------- */
function init(){
  const sel = $("idioma");
  for (const [codi, d] of Object.entries(I18N)){
    const op = document.createElement("option");
    op.value = codi; op.textContent = d.nomAuto;
    sel.appendChild(op);
  }
  sel.value = lang;
  sel.addEventListener("change", () => { lang = sel.value; localStorage.setItem("informador-idioma", lang); aplicarIdioma(true); });

  $("formulari").addEventListener("submit", (e) => { e.preventDefault(); envia(); });
  $("micro").addEventListener("click", alternaMicro);
  $("lletra-menys").addEventListener("click", () => canviaFont(-1));
  $("lletra-mes").addEventListener("click", () => canviaFont(+1));
  $("lletra-reset").addEventListener("click", () => { nivellFont = 1; aplicaFont(); });

  aplicaFont();
  aplicarIdioma(false);

  let evtInstal = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evtInstal = e; $("instalar").hidden = false; });
  $("instalar").addEventListener("click", async () => {
    if (!evtInstal) return;
    evtInstal.prompt(); await evtInstal.userChoice; evtInstal = null; $("instalar").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("instalar").hidden = true; });

  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(()=>{});

  window.addEventListener("online", enviaCua);
  enviaCua();
}

function t(){ return I18N[lang]; }

function aplicarIdioma(refresca){
  const d = t();
  document.documentElement.lang = d.bcp;
  document.documentElement.dir = "ltr";
  $("lema").textContent = d.lema;
  entrada.placeholder = d.ph;
  entrada.setAttribute("aria-label", d.ph);
  $("enviar").title = d.envia; $("enviar").setAttribute("aria-label", d.envia);
  $("micro").title = d.micro; $("micro").setAttribute("aria-label", d.micro);
  $("instalar-text").textContent = d.instal;
  $("lletra-menys").title = d.fontMenys; $("lletra-menys").setAttribute("aria-label", d.fontMenys);
  $("lletra-mes").title = d.fontMes; $("lletra-mes").setAttribute("aria-label", d.fontMes);
  $("lletra-reset").title = d.fontReset; $("lletra-reset").setAttribute("aria-label", d.fontReset);
  if (refresca || !xat.children.length){ xat.innerHTML = ""; afegixMissatge("bot", d.benvinguda); }
}

/* ---------- Tamanho da letra ---------- */
function aplicaFont(){
  document.documentElement.style.fontSize = MARGE_FONT[Math.min(Math.max(nivellFont,0), MARGE_FONT.length-1)] + "%";
  localStorage.setItem("informador-font", String(nivellFont));
}
function canviaFont(pas){ nivellFont = Math.min(Math.max(nivellFont + pas, 0), MARGE_FONT.length - 1); aplicaFont(); }

/* ---------- Chat ---------- */
function afegixMissatge(qui, text, ambEscolta){
  const div = document.createElement("div");
  div.className = "missatge " + qui;
  div.textContent = text;
  if (ambEscolta && "speechSynthesis" in window){
    const a = document.createElement("div"); a.className = "accions-missatge";
    const b = document.createElement("button");
    b.type = "button"; b.className = "boto-escolta"; b.textContent = "🔊 " + t().escolta;
    b.setAttribute("aria-label", t().escolta);
    let parlant = false;
    b.addEventListener("click", () => {
      if (parlant){ speechSynthesis.cancel(); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = t().bcpVeu;
      const veu = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(t().bcpVeu.slice(0,2)));
      if (veu) u.voice = veu;
      u.onend = u.onerror = () => { parlant = false; b.textContent = "🔊 " + t().escolta; };
      parlant = true; b.textContent = "⏹ " + t().para;
      speechSynthesis.speak(u);
    });
    a.appendChild(b); div.appendChild(a);
  }
  xat.appendChild(div);
  div.scrollIntoView({behavior:"smooth", block:"end"});
  return div;
}

function envia(){
  const text = entrada.value.trim();
  if (!text) return;
  entrada.value = "";
  afegixMissatge("usuari", text);
  speechSynthesis && speechSynthesis.cancel();
  const pensant = afegixMissatge("bot", t().pensant + " ⏳");
  const ara = new Date();
  const registro = {
    pregunta: text,
    idioma: lang,
    dia: ara.toLocaleDateString(t().bcp),
    hora: ara.toLocaleTimeString(t().bcp),
    iso: ara.toISOString(),
    sesion: sessio
  };
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registro)
  })
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(d => { pensant.remove(); afegixMissatge("bot", d.respuesta || d.respuestaText || JSON.stringify(d), true); })
  .catch(() => {
    pensant.remove();
    afegixMissatge("bot", t().errConn);
    guardaCua(registro); estat.textContent = t().cues;
  });
}

/* ---------- Fila offline ---------- */
function guardaCua(obj){
  const cua = JSON.parse(localStorage.getItem("informador-cua") || "[]");
  cua.push(obj);
  localStorage.setItem("informador-cua", JSON.stringify(cua));
}
function enviaCua(){
  if (!navigator.onLine) return;
  const cua = JSON.parse(localStorage.getItem("informador-cua") || "[]");
  if (!cua.length) return;
  const restants = [];
  (async () => {
    for (const obj of cua){
      try{
        const r = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(obj) });
        if (!r.ok) restants.push(obj);
      }catch(_){ restants.push(obj); }
    }
    localStorage.setItem("informador-cua", JSON.stringify(restants));
    if (!restants.length) estat.textContent = "";
  })();
}

/* ---------- Voz: ditado ---------- */
function alternaMicro(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ estat.textContent = "⚠️ " + t().micro + " — " + (lang==="es"?"no disponible en este navegador":"não disponível neste navegador"); return; }
  if (escoltant){ reconeixement.stop(); return; }
  reconeixement = new SR();
  reconeixement.lang = t().bcp;
  reconeixement.interimResults = false;
  reconeixement.maxAlternatives = 1;
  reconeixement.onstart = () => { escoltant = true; $("micro").setAttribute("aria-pressed","true"); estat.textContent = "🎙️ " + t().escoltant; };
  reconeixement.onend = () => { escoltant = false; $("micro").removeAttribute("aria-pressed"); estat.textContent = ""; };
  reconeixement.onerror = () => { escoltant = false; $("micro").removeAttribute("aria-pressed"); estat.textContent = ""; };
  reconeixement.onresult = (e) => {
    const text = e.results[0][0].transcript;
    entrada.value = text;
    envia();
  };
  reconeixement.start();
}

document.addEventListener("DOMContentLoaded", init);
