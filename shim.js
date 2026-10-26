// Lantern Tales app: the narrator runs on OpenRouter with the player's own key, through the same
// sample() interface the page uses on claude.ai. The key and model choices stay on this device.
(function () {
  window.__LT_APP = true;
  const API = "https://openrouter.ai/api/v1";
  const KEY = "lantern-ai";
  const PRESETS = {
    claude: { story: "anthropic/claude-sonnet-5.5", quick: "anthropic/claude-haiku-5.5", label: "Claude (best writing)" },
    budget: { story: "deepseek/deepseek-v4-pro", quick: "deepseek/deepseek-v4-flash", label: "DeepSeek (cheap)" },
    free: { story: "openrouter/free", quick: "openrouter/free", label: "Free models (slower, uneven)" },
  };
  const cfg = () => { try { return Object.assign({ story: PRESETS.claude.story, quick: PRESETS.claude.quick }, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return { story: PRESETS.claude.story, quick: PRESETS.claude.quick }; } };
  const setCfg = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  const fail = (code, message, text) => { const e = new Error(message || code); e.code = code; if (text) e.text = text; return e; };

  // Same-role messages in a row are merged; some providers reject them.
  function toMessages(input, system) {
    const list = typeof input === "string" ? [{ role: "user", content: input }] : (input || []).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }));
    const out = system ? [{ role: "system", content: system }] : [];
    for (const m of list) {
      const prev = out[out.length - 1];
      if (prev && prev.role === m.role) prev.content += "\n\n" + m.content;
      else out.push(m);
    }
    return out;
  }

  async function call(messages, opts, json) {
    const c = cfg();
    if (!c.key) throw fail("no_key");
    const model = opts.modelTier === "quick" ? c.quick : c.story;
    const stream = typeof opts.onText === "function";
    const body = { model, messages, stream, max_tokens: json ? 12000 : opts.modelTier === "complex" ? 2500 : 1500, temperature: json ? 0.5 : 0.9 };
    let res;
    try {
      res = await fetch(API + "/chat/completions", {
        method: "POST", signal: opts.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key, "HTTP-Referer": "https://lantern-tales.app", "X-Title": "Lantern Tales" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw fail("cancelled");
      throw fail("network", String(e && e.message));
    }
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = (j.error && j.error.message) || ""; } catch {}
      const code = res.status === 401 ? "bad_key" : res.status === 402 ? "credits" : res.status === 429 ? "rate_limited"
        : /context|too long|maximum.*tokens/i.test(msg) ? "prompt_too_large" : res.status === 400 || res.status === 404 ? "model_error" : "upstream_error";
      throw fail(code, msg);
    }
    let text = "", finish = null;
    if (!stream) {
      const j = await res.json();
      if (j.error) throw fail("upstream_error", j.error.message);
      const ch = j.choices && j.choices[0];
      text = (ch && ch.message && ch.message.content) || "";
      finish = ch && ch.finish_reason;
    } else {
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            let j; try { j = JSON.parse(data); } catch { continue; }
            if (j.error) throw fail("upstream_error", j.error.message, text);
            const ch = j.choices && j.choices[0];
            const d = ch && ch.delta && ch.delta.content;
            if (d) { text += d; opts.onText({ text, delta: d }); }
            if (ch && ch.finish_reason) finish = ch.finish_reason;
          }
        }
      } catch (e) {
        if (e && e.name === "AbortError") throw fail("cancelled", "", text);
        if (e && e.code) throw e;
        throw fail("network", String(e && e.message), text);
      }
    }
    if (finish === "content_filter" || finish === "refusal") throw fail("refused", "", text);
    if (!text.trim()) throw fail("empty_completion");
    return { text, truncated: finish === "length" };
  }

  function parseJSON(t) {
    t = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(t); } catch {}
    const start = t.search(/[{[]/);
    if (start < 0) throw new Error("no JSON");
    const open = t[start], close = open === "{" ? "}" : "]";
    const end = t.lastIndexOf(close);
    const body = t.slice(start, end + 1);
    try { return JSON.parse(body); } catch {}
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"));
  }

  const JSON_SYSTEM = "You are a game engine component. Reply with only one valid JSON value: no prose, no explanations, no code fences.";
  async function sample(input, opts) { return call(toMessages(input), opts || {}, false); }
  sample.json = async function (input, opts) {
    opts = Object.assign({}, opts || {}); delete opts.onText;
    const msgs = toMessages(input, JSON_SYSTEM);
    const r = await call(msgs, opts, true);
    try { return parseJSON(r.text); } catch {}
    const again = await call(msgs.concat([{ role: "assistant", content: r.text.slice(0, 4000) }, { role: "user", content: "That wasn't valid JSON. Reply again with only the JSON value." }]), opts, true);
    try { return parseJSON(again.text); } catch { throw fail("upstream_error", "The model didn't return valid JSON."); }
  };
  sample.limits = async () => ({ images: false });
  window.claude = { use: async (name) => (name === "sample" ? sample : null) };

  // ---------- AI connection settings, and a welcome screen until a key is saved ----------
  let modelsLoaded = false;
  async function loadModels() {
    if (modelsLoaded) return;
    modelsLoaded = true;
    try {
      const j = await (await fetch(API + "/models")).json();
      const dl = document.getElementById("orModels");
      for (const m of (j.data || []).sort((a, b) => a.id.localeCompare(b.id))) {
        const o = document.createElement("option");
        const p = m.pricing || {};
        o.value = m.id;
        o.label = (m.name || m.id) + (+p.prompt === 0 && +p.completion === 0 ? " · free" : " · $" + (+p.prompt * 1e6).toFixed(2) + " / $" + (+p.completion * 1e6).toFixed(2) + " per M tokens");
        dl.append(o);
      }
    } catch { modelsLoaded = false; }
  }
  async function test(statusEl) {
    statusEl.textContent = "Testing…";
    try {
      const r = await sample("Reply with exactly: The lantern is lit.", { modelTier: "default" });
      statusEl.textContent = "Connected: “" + r.text.trim().slice(0, 60) + "”";
      return true;
    } catch (e) {
      statusEl.textContent = { no_key: "Paste your key first.", bad_key: "OpenRouter didn't accept that key.", credits: "This account has no credits. Add some on openrouter.ai or use the free preset.", model_error: "That story model didn't work. Pick another.", network: "Couldn't reach OpenRouter." }[e.code] || "Failed: " + (e.message || e.code);
      return false;
    }
  }
  const markers = [];
  const markAll = () => markers.forEach((m) => m());
  function bindBox(prefix) {
    const $ = (id) => document.getElementById(prefix + id);
    const c = cfg();
    $("Key").value = c.key || "";
    if ($("Story")) { $("Story").value = c.story; $("Quick").value = c.quick; }
    const store = () => {
      const n = cfg();
      n.key = $("Key").value.trim();
      if ($("Story")) { n.story = $("Story").value.trim() || PRESETS.claude.story; n.quick = $("Quick").value.trim() || PRESETS.claude.quick; }
      setCfg(n);
    };
    for (const id of ["Key", "Story", "Quick"]) if ($(id)) $(id).addEventListener("change", () => { store(); markAll(); });
    const presets = $("Presets");
    const mark = () => { if (presets) for (const b of presets.children) { const p = PRESETS[b.dataset.k], n = cfg(); b.setAttribute("aria-pressed", String(p.story === n.story && p.quick === n.quick)); } };
    if (presets) for (const [k, p] of Object.entries(PRESETS)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn preset"; b.textContent = p.label; b.dataset.k = k;
      b.onclick = () => { const n = cfg(); n.story = p.story; n.quick = p.quick; setCfg(n); if ($("Story")) { $("Story").value = p.story; $("Quick").value = p.quick; } markAll(); };
      presets.append(b);
    }
    markers.push(mark); mark();
    return store;
  }
  document.addEventListener("DOMContentLoaded", () => {
    const store = bindBox("or");
    document.getElementById("orTest").onclick = () => { store(); test(document.getElementById("orStatus")); };
    // the settings box shows what's saved now (the welcome screen may have changed it)
    const refresh = () => { const c = cfg(); document.getElementById("orKey").value = c.key || ""; document.getElementById("orStory").value = c.story; document.getElementById("orQuick").value = c.quick; markAll(); };
    document.getElementById("orKey").addEventListener("focus", loadModels);
    document.querySelectorAll('.tab[data-tab="settings"]').forEach((t) => t.addEventListener("click", () => { refresh(); loadModels(); }));
    const welcome = document.getElementById("welcome");
    const storeW = bindBox("w");
    if (!cfg().key) welcome.hidden = false;
    document.getElementById("wSave").onclick = async () => {
      storeW();
      if (!cfg().key) { document.getElementById("wStatus").textContent = "Paste your key first."; return; }
      if (await test(document.getElementById("wStatus"))) {
        refresh();
        setTimeout(() => { welcome.hidden = true; }, 700);
      }
    };
    document.getElementById("wLater").onclick = () => { welcome.hidden = true; };
    // installable app on the web (not inside the desktop program, which serves its own files)
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
