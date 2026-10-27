/**
 * Lab notebook — Google Apps Script server.
 *
 * Students don't sign in. They type their school email, name and project title at the
 * top of the page; entries are filed under entries/<email name>/<project>/ and listed
 * again whenever they enter the same email. This script (running as the instructor)
 * writes to a private GitHub repository with the instructor's token, which students
 * never see.
 *
 * Script properties (Project Settings → Script properties):
 *   GITHUB_TOKEN    fine-grained token, Contents: Read and write on the one notebook repo
 *   GITHUB_OWNER    account or organization that owns the repo
 *   GITHUB_REPO     repository name
 *   GITHUB_BRANCH   optional, default "main"
 *   ALLOWED_DOMAIN  optional, default "umb.edu"
 *   ROSTER          optional comma-separated student emails; if set, only these work
 *                   (catches typos that would otherwise create a stray folder)
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20;
const TEXT_KEYS = ["title", "date", "collab", "question", "hypothesis", "prediction",
  "materials", "procedure", "deviations", "observations", "interpretation", "next"];
const REQUIRED = { title: "experiment title", date: "date performed", hypothesis: "hypothesis",
  procedure: "procedure", observations: "observations and results" };

/* ---------------- Web app entry point ---------------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Lab notebook")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* ---------------- Configuration and identity ---------------- */

function list_(s) {
  return String(s || "").split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
}

function cfg_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!p.GITHUB_TOKEN || !p.GITHUB_OWNER || !p.GITHUB_REPO) {
    throw new Error("The notebook isn’t set up yet: the instructor needs to add GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO to the script properties.");
  }
  return {
    token: p.GITHUB_TOKEN.trim(),
    owner: p.GITHUB_OWNER.trim(),
    repo: p.GITHUB_REPO.trim(),
    branch: (p.GITHUB_BRANCH || "main").trim(),
    domain: (p.ALLOWED_DOMAIN || "umb.edu").trim().toLowerCase(),
    roster: list_(p.ROSTER)
  };
}

// Turns what the student typed at the top of the page into a folder and signature.
function ident_(info) {
  const c = cfg_();
  info = info || {};
  const email = String(info.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter your full school email address.");
  if (!email.endsWith("@" + c.domain)) throw new Error(`Use your @${c.domain} email address.`);
  if (c.roster.length && c.roster.indexOf(email) === -1) {
    throw new Error(`${email} isn’t on this course’s list. Check the spelling, or ask your instructor to add it.`);
  }
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 100);
  const projectTitle = clean(info.project);
  return {
    email: email,
    folder: email.split("@")[0].replace(/[^a-z0-9._-]+/g, "-"),
    name: clean(info.name),
    projectTitle: projectTitle,
    project: projectTitle ? slugify_(projectTitle) : "",
    cfg: c
  };
}

function needSignature_(u) {
  if (!u.name) throw new Error("Enter your name at the top, so the entry is signed.");
}

/* ---------------- GitHub ---------------- */

function friendly_(code, m) {
  if (code === 401) return "The notebook’s GitHub token was rejected or has expired. Tell your instructor.";
  if (code === 403 && /rate limit/i.test(m)) return "GitHub’s rate limit was reached. Wait a few minutes and try again.";
  if (code === 403) return "The notebook’s GitHub token doesn’t have write access. Tell your instructor.";
  if (code === 404) return "That notebook file couldn’t be found.";
  if (code === 409) return "The notebook changed while you were working. Open the entry again and retry.";
  if (code === 422) return "GitHub refused the file" + (m ? `: ${m}` : "") + ".";
  return `GitHub returned an error (${code})` + (m ? `: ${m}` : "") + ".";
}

function gh_(c, method, path, body, raw) {
  const opts = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + c.token,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  };
  if (body) { opts.contentType = "application/json"; opts.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch("https://api.github.com" + path, opts);
  const code = res.getResponseCode();
  if (code >= 300) {
    let m = "";
    try { m = JSON.parse(res.getContentText()).message || ""; } catch (e) {}
    const err = new Error(friendly_(code, m));
    err.status = code;
    throw err;
  }
  return res;
}

const encPath_ = (p) => p.split("/").map(encodeURIComponent).join("/");
const repoBase_ = (c) => `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
const contents_ = (c, p) => `${repoBase_(c)}/contents/${encPath_(p)}`;
const ref_ = (c) => `?ref=${encodeURIComponent(c.branch)}`;

function exists_(c, p) {
  try { gh_(c, "get", contents_(c, p) + ref_(c)); return true; }
  catch (e) { if (e.status === 404) return false; throw e; }
}

function put_(u, p, b64, message, sha) {
  const body = {
    message: message,
    content: b64,
    branch: u.cfg.branch,
    author: { name: u.name || u.folder, email: u.email }
  };
  if (sha) body.sha = sha;
  return JSON.parse(gh_(u.cfg, "put", contents_(u.cfg, p), body).getContentText());
}

function readText_(c, p) {
  const j = JSON.parse(gh_(c, "get", contents_(c, p) + ref_(c)).getContentText());
  let text;
  if (j.content) text = Utilities.newBlob(Utilities.base64Decode(j.content.replace(/\s/g, ""))).getDataAsString("UTF-8");
  else text = gh_(c, "get", contents_(c, p) + ref_(c), null, true).getContentText("UTF-8");
  return { text: text, sha: j.sha };
}

/* ---------------- Paths ---------------- */

function checkPath_(u, p) {
  p = String(p || "");
  if (!/^entries\//.test(p) || p.split("/").some(s => s === ".." || s === "")) throw new Error("That isn’t a notebook file.");
  if (p.indexOf(`entries/${u.folder}/`) !== 0) throw new Error("That entry is in a different notebook.");
  return p;
}

/* ---------------- Markdown ---------------- */

function slugify_(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "entry";
}
function safeName_(n) {
  return String(n).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}
const isImage_ = (n) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n);

function cleanFields_(fields) {
  const f = {};
  TEXT_KEYS.forEach(k => { f[k] = String((fields && fields[k]) || "").slice(0, 50000); });
  return f;
}

function uniqueNames_(names) {
  const out = [];
  names.forEach(n => {
    let name = safeName_(n), i = 2;
    const stem = name.replace(/(\.[^.]+)?$/, ""), ext = (name.match(/\.[^.]+$/) || [""])[0];
    while (out.indexOf(name) !== -1) name = `${stem}-${i++}${ext}`;
    out.push(name);
  });
  return out;
}

function buildMarkdown_(f, u, assetBase, fileNames, recordedIso) {
  const L = [];
  const yaml = (k, v) => { if (v && String(v).trim()) L.push(`${k}: ${JSON.stringify(String(v).trim())}`); };
  L.push("---");
  yaml("title", f.title);
  L.push(`date: ${f.date}`);
  yaml("author", u.name);
  yaml("student", u.email);
  yaml("project", u.projectTitle);
  L.push(`recorded: ${recordedIso}`, "---", "");
  L.push(`# ${f.title.trim() || "Untitled entry"}`, "");
  L.push(`- **Date performed:** ${f.date}`);
  L.push(`- **Recorded by:** ${(u.name || u.folder).trim()} (${u.email})`);
  if (u.projectTitle) L.push(`- **Project:** ${u.projectTitle}`);
  if (f.collab.trim()) L.push(`- **Worked with:** ${f.collab.trim()}`);
  L.push("");
  const sec = (h, text, fallback) => {
    const t = String(text || "").trim();
    if (t || fallback) L.push(`## ${h}`, "", t || fallback, "");
  };
  sec("Question", f.question);
  sec("Hypothesis", f.hypothesis);
  sec("Prediction", f.prediction);
  sec("Materials and reagents", f.materials);
  sec("Procedure", f.procedure);
  sec("Deviations from the protocol", f.deviations, "_None recorded._");
  sec("Observations and results", f.observations);
  if (fileNames.length) {
    L.push("### Data files", "");
    fileNames.filter(isImage_).forEach(n => L.push(`![${n}](${assetBase}/${n})`, ""));
    const others = fileNames.filter(n => !isImage_(n));
    others.forEach(n => L.push(`- [${n}](${assetBase}/${n})`));
    if (others.length) L.push("");
  }
  sec("Interpretation", f.interpretation);
  sec("Next steps", f.next);
  return L.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
}

/* ---------------- Functions the page calls ---------------- */

function config() {
  const c = cfg_();
  return { domain: c.domain, maxFileBytes: MAX_FILE_BYTES, maxEntryBytes: MAX_ENTRY_BYTES };
}

// Every entry filed under this email, newest first.
function listEntries(info) {
  const u = ident_(info), c = u.cfg;
  let tree;
  try {
    tree = JSON.parse(gh_(c, "get", `${repoBase_(c)}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`).getContentText()).tree || [];
  } catch (e) {
    if (e.status === 404 || e.status === 409) return [];
    throw e;
  }
  const prefix = `entries/${u.folder}/`;
  return tree
    .filter(t => t.type === "blob" && t.path.indexOf(prefix) === 0 && /\.md$/i.test(t.path) && !/\/assets\//.test(t.path))
    .map(t => t.path)
    .sort((a, b) => b.split("/").pop().localeCompare(a.split("/").pop()));
}

function getEntry(info, path) {
  const u = ident_(info);
  return readText_(u.cfg, checkPath_(u, path)).text;
}

function getAsset(info, path) {
  const u = ident_(info);
  path = checkPath_(u, path);
  const blob = gh_(u.cfg, "get", contents_(u.cfg, path) + ref_(u.cfg), null, true).getBlob();
  const ext = (path.match(/\.([^.]+)$/) || ["", ""])[1].toLowerCase();
  const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    svg: "image/svg+xml", csv: "text/csv", txt: "text/plain", pdf: "application/pdf" };
  return { b64: Utilities.base64Encode(blob.getBytes()), mime: types[ext] || "application/octet-stream" };
}

function previewEntry(info, fields, fileNames) {
  const u = ident_(info);
  return buildMarkdown_(cleanFields_(fields), u, "assets/preview",
    uniqueNames_((fileNames || []).slice(0, MAX_FILES)), new Date().toISOString());
}

function saveEntry(info, payload) {
  const u = ident_(info);
  needSignature_(u);
  if (!u.project) throw new Error("Enter a project title at the top. Entries are filed under it.");
  const f = cleanFields_(payload && payload.fields);
  const missing = Object.keys(REQUIRED).filter(k => !f[k].trim());
  if (missing.length) throw new Error("Fill in before saving: " + missing.map(k => REQUIRED[k]).join(", ") + ".");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) throw new Error("The date performed isn’t a valid date.");

  const files = ((payload && payload.files) || []).slice(0, MAX_FILES);
  let total = 0;
  files.forEach(x => {
    const bytes = Math.floor(String(x.b64 || "").length * 3 / 4);
    if (bytes > MAX_FILE_BYTES) throw new Error(`${x.name} is over 10 MB. Store it elsewhere and note its location in the entry.`);
    total += bytes;
  });
  if (total > MAX_ENTRY_BYTES) throw new Error("The attached files add up to more than 25 MB. Split them across entries or store some elsewhere.");
  const names = uniqueNames_(files.map(x => x.name));

  const dir = `entries/${u.folder}/${u.project}`;
  const base = `${f.date}-${slugify_(f.title)}`;
  let name = base, i = 2;
  while (exists_(u.cfg, `${dir}/${name}.md`)) name = `${base}-${i++}`;
  const assetBase = `assets/${name}`;

  files.forEach((x, k) => {
    put_(u, `${dir}/${assetBase}/${names[k]}`, String(x.b64), `Data for “${f.title.trim()}”: ${names[k]}`);
  });
  const path = `${dir}/${name}.md`;
  const md = buildMarkdown_(f, u, assetBase, names, new Date().toISOString());
  put_(u, path, Utilities.base64Encode(md, Utilities.Charset.UTF_8), `Notebook entry: ${f.title.trim()} (${f.date})`);
  return path;
}

function appendAddendum(info, path, text) {
  const u = ident_(info);
  needSignature_(u);
  path = checkPath_(u, path);
  const add = String(text || "").trim().slice(0, 50000);
  if (!add) throw new Error("Write the addendum first.");
  const cur = readText_(u.cfg, path);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const updated = cur.text.replace(/\s+$/, "") + `\n\n---\n\n## Addendum, ${stamp} (${u.name})\n\n${add}\n`;
  put_(u, path, Utilities.base64Encode(updated, Utilities.Charset.UTF_8), `Addendum: ${path.split("/").pop()}`, cur.sha);
  return updated;
}
