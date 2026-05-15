// ============================================================
//  portfolio.js — Espace apprenant SkillBadge (dashboard)
// ============================================================

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from "./firebase.js";
import {
  observerConnexion,
  getProfil,
  deconnecter,
  lierWallet,
  mettreAJourProfil,
} from "./auth.js";
import {
  ecouterBadgesApprenant,
  formaterDate,
  couleurNiveau,
  couleurDomaine,
} from "./badges.js";
import { envoyerDemande, ecouterDemandesApprenant } from "./demandes.js";
import { connectWallet, lireChainIdMetaMask } from "./web3.js";

/** Domaines alignés sur badges.js (domaineIds) */
const DOMAINES = [
  "Développement Web",
  "Développement Mobile",
  "Data & IA",
  "Cybersécurité",
  "UI/UX Design",
  "DevOps",
  "Blockchain",
  "Marketing Digital",
];

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

const NIVEAU_ORDRE = { Débutant: 0, Intermédiaire: 1, Avancé: 2, Expert: 3 };

const POLYGONSCAN = "https://amoy.polygonscan.com/tx/";

const MAX_PREUVE_OCTETS = 2 * 1024 * 1024;

const FORM_SUFFIXES = ["dashboard", "mobile", "tab"];

let currentUser = null;
let currentProfil = null;
let badgesData = [];
let demandesData = [];
let formateursList = [];
let unsubscribers = [];
let currentPage = "dashboard";
let selectedBadge = null;

/** Fichiers sélectionnés par formulaire (suffixe) */
const preuveFichiers = { dashboard: null, mobile: null, tab: null };

// ── Utilitaires UI ─────────────────────────────────────────

function toast(message, type = "info") {
  const host = document.getElementById("toast-container");
  if (!host) return;
  const el = document.createElement("div");
  const tones = {
    success: "bg-emerald-900/95 border-emerald-600 text-emerald-100",
    error: "bg-red-900/95 border-red-600 text-red-100",
    info: "bg-slate-800/95 border-slate-600 text-slate-100",
  };
  el.className = `pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${tones[type] || tones.info}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 4500);
}

function setGlobalLoading(show) {
  const el = document.getElementById("global-loading");
  if (!el) return;
  el.classList.toggle("hidden", !show);
  el.setAttribute("aria-busy", show ? "true" : "false");
}

function tronquerAdresse(addr) {
  if (!addr || addr.length < 10) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function basePath() {
  const p = window.location.pathname;
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i + 1) : "/";
}

function buildVerifyUrl(wallet) {
  if (!wallet) return "";
  const w = encodeURIComponent(wallet);
  return `${window.location.origin}${basePath()}verify.html?address=${w}`;
}

function initiales(nom) {
  if (!nom || typeof nom !== "string") return "?";
  const parts = nom.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

// ── Données formateurs (liste déroulante) ───────────────────

async function chargerFormateurs() {
  try {
    const snap = await get(ref(db, "utilisateurs"));
    if (!snap.exists()) {
      formateursList = [];
      return;
    }
    const raw = snap.val();
    formateursList = Object.entries(raw)
      .filter(([, v]) => v && v.role === "formateur")
      .map(([id, v]) => ({
        id,
        nom: v.nom || "Formateur",
        organisation: v.organisation || "",
        wallet: v.wallet || "",
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  } catch (e) {
    console.error(e);
    formateursList = [];
    toast("Impossible de charger la liste des formateurs.", "error");
  }
}

function remplirSelectFormateurs() {
  FORM_SUFFIXES.forEach((s) => {
    const fs = document.getElementById(`d-formateur-${s}`);
    if (!fs) return;
    fs.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Choisir un formateur…";
    fs.appendChild(ph);
    formateursList.forEach((f) => {
      const o = document.createElement("option");
      o.value = f.id;
      const walletShort = f.wallet ? tronquerAdresse(f.wallet) : "—";
      o.textContent = `${f.nom}${f.organisation ? ` — ${f.organisation}` : ""} (${walletShort})`;
      fs.appendChild(o);
    });
  });
}

function remplirSelectsGlobaux() {
  const fd = document.getElementById("filter-domaine");
  const fn = document.getElementById("filter-niveau");
  if (fd && fd.options.length <= 1) {
    DOMAINES.forEach((d) => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      fd.appendChild(o);
    });
  }
  if (fn && fn.options.length <= 1) {
    NIVEAUX.forEach((n) => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      fn.appendChild(o);
    });
  }

  FORM_SUFFIXES.forEach((s) => {
    const ds = document.getElementById(`d-domaine-${s}`);
    const ns = document.getElementById(`d-niveau-${s}`);
    if (ds && ds.options.length === 0) {
      DOMAINES.forEach((d) => {
        const o = document.createElement("option");
        o.value = d;
        o.textContent = d;
        ds.appendChild(o);
      });
    }
    if (ns && ns.options.length === 0) {
      NIVEAUX.forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        ns.appendChild(o);
      });
    }
  });

  remplirSelectFormateurs();
}

function syncEmailsDemande() {
  const email = currentProfil?.email || "";
  FORM_SUFFIXES.forEach((s) => {
    const el = document.getElementById(`d-email-${s}`);
    if (el) el.value = email;
  });
}

// ── Stats & profil % ───────────────────────────────────────

function badgesActifs() {
  return badgesData.filter((b) => b.statut !== "révoqué");
}

function niveauMaxAtteint() {
  let max = -1;
  let label = "—";
  badgesActifs().forEach((b) => {
    const n = b.niveau;
    const ord = NIVEAU_ORDRE[n];
    if (ord !== undefined && ord > max) {
      max = ord;
      label = n;
    }
  });
  return label;
}

function pourcentageProfil() {
  if (!currentProfil) return 0;
  let pts = 0;
  const total = 5;
  if (currentProfil.nom && String(currentProfil.nom).trim()) pts++;
  if (currentProfil.email) pts++;
  if (currentProfil.organisation && String(currentProfil.organisation).trim()) pts++;
  const w = currentProfil.wallet || "";
  if (/^0x[a-fA-F0-9]{40}$/.test(w)) pts++;
  if (badgesActifs().length >= 1) pts++;
  return Math.round((pts / total) * 100);
}

function mettreAJourStats() {
  const elB = document.getElementById("stat-badges");
  const elN = document.getElementById("stat-niveau");
  const elD = document.getElementById("stat-demandes");
  const elP = document.getElementById("stat-profil");
  if (elB) elB.textContent = String(badgesActifs().length);
  if (elN) elN.textContent = niveauMaxAtteint();
  const att = demandesData.filter((d) => d.statut === "en_attente").length;
  if (elD) elD.textContent = String(att);
  if (elP) elP.textContent = `${pourcentageProfil()}%`;

  const lbl = document.getElementById("badge-count-label");
  if (lbl) lbl.textContent = `Mes badges NFT (${badgesActifs().length})`;
}

// ── Rendu badges (cartes) ──────────────────────────────────

function carteBadgeHtml(badge, { compact = false } = {}) {
  const pill = couleurNiveau(badge.niveau);
  const domBg = couleurDomaine(badge.domaine) || "#334155";
  const dateStr = formaterDate(badge.dateEmission);
  const cls = compact
    ? "p-4 flex flex-col gap-3"
    : "p-5 flex flex-col gap-3";
  return `
    <article class="rounded-2xl shadow-lg bg-slate-800 border border-slate-700 ${cls} badge-card cursor-pointer hover:border-primary-600/50 transition-colors" data-badge-id="${escapeAttr(badge.id)}" tabindex="0" role="button" aria-label="Détails du badge ${escapeAttr(badge.nom)}">
      <div class="flex items-start gap-3">
        <div class="hex-badge" style="--hex-bg:${escapeAttr(domBg)}" aria-hidden="true"></div>
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-white truncate">${escapeAttr(badge.nom)}</h3>
          <p class="text-xs text-slate-400 truncate">${escapeAttr(badge.domaine || "")}</p>
          <span class="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full" style="background:${pill.bg};color:${pill.color}">${escapeAttr(badge.niveau || "")}</span>
        </div>
      </div>
      <p class="text-xs text-slate-500">${dateStr}</p>
      <button type="button" class="btn-partager-badge btn-scale w-full py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium" data-badge-id="${escapeAttr(badge.id)}">Partager</button>
    </article>`;
}

function bindBadgeCardClicks(container) {
  if (!container) return;
  container.querySelectorAll(".badge-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-partager-badge")) return;
      const id = card.getAttribute("data-badge-id");
      const b = badgesData.find((x) => x.id === id);
      if (b) ouvrirModalBadge(b);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });
  container.querySelectorAll(".btn-partager-badge").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-badge-id");
      const b = badgesData.find((x) => x.id === id);
      if (b) partagerBadge(b);
    });
  });
}

function renderGrillesBadges() {
  const recent = document.getElementById("grid-recent-badges");
  const all = document.getElementById("grid-all-badges");
  const actifs = badgesActifs();
  const slice = actifs.slice(0, 6);

  if (recent) {
    recent.innerHTML = slice.length
      ? slice.map((b) => carteBadgeHtml(b, { compact: true })).join("")
      : `<p class="text-slate-500 col-span-full text-sm">Aucun badge pour le moment.</p>`;
    bindBadgeCardClicks(recent);
  }

  const domaineF = document.getElementById("filter-domaine")?.value || "";
  const niveauF = document.getElementById("filter-niveau")?.value || "";
  const q = (document.getElementById("filter-search")?.value || "").trim().toLowerCase();

  let filtered = actifs;
  if (domaineF) filtered = filtered.filter((b) => b.domaine === domaineF);
  if (niveauF) filtered = filtered.filter((b) => b.niveau === niveauF);
  if (q) {
    filtered = filtered.filter(
      (b) =>
        (b.nom && b.nom.toLowerCase().includes(q)) ||
        (b.domaine && b.domaine.toLowerCase().includes(q))
    );
  }

  if (all) {
    all.innerHTML = filtered.length
      ? filtered.map((b) => carteBadgeHtml(b)).join("")
      : `<p class="text-slate-500 col-span-full text-sm">Aucun badge ne correspond aux filtres.</p>`;
    bindBadgeCardClicks(all);
  }

  renderChartDomaines();
}

// ── Graphique simple (barres) ───────────────────────────────

function renderChartDomaines() {
  const host = document.getElementById("chart-domaines");
  if (!host) return;
  const actifs = badgesActifs();
  const counts = {};
  DOMAINES.forEach((d) => {
    counts[d] = 0;
  });
  actifs.forEach((b) => {
    const d = b.domaine || "Autre";
    counts[d] = (counts[d] || 0) + 1;
  });
  const max = Math.max(1, ...Object.values(counts));
  host.innerHTML = DOMAINES.map((d) => {
    const n = counts[d] || 0;
    const pct = Math.round((n / max) * 100);
    return `
      <div>
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>${escapeAttr(d)}</span>
          <span>${n}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div class="h-full rounded-full bg-primary-600 transition-all" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join("");
}

// ── Liste demandes ──────────────────────────────────────────

function libelleStatutDemande(statut) {
  if (statut === "en_attente") return "En attente";
  if (statut === "acceptée") return "Acceptée";
  if (statut === "refusée") return "Refusée";
  return statut || "—";
}

function classeStatutDemande(statut) {
  if (statut === "en_attente") return "bg-amber-900/50 text-amber-300 border-amber-700";
  if (statut === "acceptée") return "bg-emerald-900/50 text-emerald-300 border-emerald-700";
  if (statut === "refusée") return "bg-red-900/50 text-red-300 border-red-700";
  return "bg-slate-700 text-slate-300 border-slate-600";
}

function renderListeDemandes() {
  const ul = document.getElementById("liste-demandes");
  if (!ul) return;
  if (!demandesData.length) {
    ul.innerHTML = `<li class="text-slate-500 text-sm py-4">Aucune demande pour le moment.</li>`;
    return;
  }
  ul.innerHTML = demandesData
    .map((d) => {
      const st = classeStatutDemande(d.statut);
      const dateStr = formaterDate(d.createdAt);
      const fmt = formateursList.find((f) => f.id === d.formateurId);
      const fmtNom = fmt ? fmt.nom : d.formateurId || "—";
      return `
        <li class="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span class="text-sm font-medium text-white">${escapeAttr(d.domaine || "")} — ${escapeAttr(d.niveau || "")}</span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full border ${st}">${libelleStatutDemande(d.statut)}</span>
          </div>
          <p class="text-xs text-slate-500 mb-1">Vers : ${escapeAttr(fmtNom)} — ${dateStr}</p>
          ${d.competence ? `<p class="text-xs text-slate-400">Compétence : ${escapeAttr(d.competence)}</p>` : ""}
          ${d.preuveNom ? `<p class="text-xs text-slate-500">Pièce jointe (nom) : ${escapeAttr(d.preuveNom)}</p>` : ""}
          <p class="text-sm text-slate-300 mt-2 line-clamp-3">${escapeAttr(d.message || "")}</p>
        </li>`;
    })
    .join("");
}

// ── Historique (timeline) ───────────────────────────────────

function renderHistorique() {
  const host = document.getElementById("timeline-historique");
  if (!host) return;

  const de = document.getElementById("hist-date-de")?.value;
  const a = document.getElementById("hist-date-a")?.value;
  const tDe = de ? new Date(de + "T00:00:00").getTime() : null;
  const tA = a ? new Date(a + "T23:59:59").getTime() : null;

  const events = [];

  badgesActifs().forEach((b) => {
    const t = b.dateEmission;
    if (tDe != null && t < tDe) return;
    if (tA != null && t > tA) return;
    events.push({
      t,
      type: "badge",
      titre: `Badge reçu : ${b.nom}`,
      detail: `${b.domaine} — ${b.niveau}`,
    });
  });

  demandesData.forEach((d) => {
    const t = d.createdAt;
    if (tDe != null && t < tDe) return;
    if (tA != null && t > tA) return;
    events.push({
      t,
      type: "demande",
      titre: "Demande envoyée",
      detail: `${d.domaine} — ${d.niveau} (${libelleStatutDemande(d.statut)})`,
    });
  });

  if (currentProfil?.walletUpdatedAt) {
    const t = currentProfil.walletUpdatedAt;
    if ((tDe == null || t >= tDe) && (tA == null || t <= tA)) {
      events.push({
        t,
        type: "wallet",
        titre: "Wallet enregistré",
        detail: tronquerAdresse(currentProfil.wallet) || "—",
      });
    }
  }

  events.sort((x, y) => y.t - x.t);

  if (!events.length) {
    host.innerHTML = `<p class="text-slate-500 text-sm">Aucun événement sur cette période.</p>`;
    return;
  }

  host.innerHTML = events
    .map(
      (e) => `
    <div class="timeline-item">
      <p class="font-medium text-white">${escapeAttr(e.titre)}</p>
      <p class="text-slate-400 text-xs mt-0.5">${formaterDate(e.t)}</p>
      <p class="text-slate-500 text-sm mt-1">${escapeAttr(e.detail)}</p>
    </div>`
    )
    .join("");
}

// ── Modale badge ────────────────────────────────────────────

function ouvrirModalBadge(badge) {
  selectedBadge = badge;
  const dlg = document.getElementById("badge-modal");
  if (!dlg) return;

  const pill = couleurNiveau(badge.niveau);
  const domBg = couleurDomaine(badge.domaine) || "#334155";

  document.getElementById("modal-hex").style.setProperty("--hex-bg", domBg);
  document.getElementById("modal-badge-title").textContent = badge.nom || "—";
  document.getElementById("modal-domaine").textContent = badge.domaine || "—";
  const pillEl = document.getElementById("modal-niveau-pill");
  pillEl.textContent = badge.niveau || "—";
  pillEl.style.background = pill.bg;
  pillEl.style.color = pill.color;

  document.getElementById("modal-emetteur").textContent = `${badge.formateurNom || ""} (${badge.organisation || ""})`.trim() || "—";
  document.getElementById("modal-date-emit").textContent = formaterDate(badge.dateEmission);
  document.getElementById("modal-validite").textContent = badge.dateExpiration
    ? formaterDate(badge.dateExpiration)
    : "Illimité";
  document.getElementById("modal-score").textContent = badge.score != null ? String(badge.score) : "—";

  const tx = badge.txHash || badge.nftHash || "—";
  document.getElementById("modal-tx").textContent = tx;
  const scan = document.getElementById("modal-polygonscan");
  if (/^0x[a-fA-F0-9]{64}$/.test(tx)) {
    scan.href = `${POLYGONSCAN}${tx}`;
    scan.classList.remove("pointer-events-none", "opacity-50");
  } else {
    scan.href = "#";
    scan.classList.add("pointer-events-none", "opacity-50");
  }

  const onchain = document.getElementById("modal-onchain-badge");
  if (badge.blockchainUsed) {
    onchain.classList.remove("hidden");
  } else {
    onchain.classList.add("hidden");
  }

  dlg.showModal();
}

function fermerModalBadge() {
  const dlg = document.getElementById("badge-modal");
  if (dlg?.open) dlg.close();
  selectedBadge = null;
}

function partagerBadge(badge) {
  const w = currentProfil?.wallet;
  if (!w || !/^0x[a-fA-F0-9]{40}$/.test(w)) {
    toast("Connectez et enregistrez un wallet pour générer un lien public.", "error");
    return;
  }
  const url = `${buildVerifyUrl(w)}&badgeId=${encodeURIComponent(badge.id)}`;
  navigator.clipboard.writeText(url).then(
    () => toast("Lien copié dans le presse-papiers.", "success"),
    () => toast(url, "info")
  );
}

function partagerWhatsAppPortfolio() {
  const w = currentProfil?.wallet;
  if (!w || !/^0x[a-fA-F0-9]{40}$/.test(w)) {
    toast("Enregistrez d’abord votre wallet (MetaMask).", "error");
    return;
  }
  const url = buildVerifyUrl(w);
  const text = encodeURIComponent(`Voici mon portfolio SkillBadge : ${url}`);
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

// ── Formulaires demande ─────────────────────────────────────

function getFormConfig(suffix) {
  return {
    suffix,
    email: document.getElementById(`d-email-${suffix}`),
    competence: document.getElementById(`d-comp-${suffix}`),
    domaine: document.getElementById(`d-domaine-${suffix}`),
    niveau: document.getElementById(`d-niveau-${suffix}`),
    formateur: document.getElementById(`d-formateur-${suffix}`),
    file: document.getElementById(`d-file-${suffix}`),
    drop: document.getElementById(`d-drop-${suffix}`),
    fileName: document.getElementById(`d-file-name-${suffix}`),
    message: document.getElementById(`d-msg-${suffix}`),
  };
}

function setupDragDrop(suffix) {
  const cfg = getFormConfig(suffix);
  if (!cfg.drop || !cfg.file) return;

  const zone = cfg.drop;
  const input = cfg.file;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("border-primary-500", "bg-slate-800");
    });
  });
  zone.addEventListener("dragleave", () => {
    zone.classList.remove("border-primary-500", "bg-slate-800");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("border-primary-500", "bg-slate-800");
    const f = e.dataTransfer?.files?.[0];
    if (f) assignerPreuve(suffix, f, cfg);
  });

  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) assignerPreuve(suffix, f, cfg);
  });
}

function assignerPreuve(suffix, file, cfg) {
  if (file.size > MAX_PREUVE_OCTETS) {
    toast(`Fichier trop volumineux (max ${MAX_PREUVE_OCTETS / 1024 / 1024} Mo).`, "error");
    return;
  }
  preuveFichiers[suffix] = file;
  if (cfg.fileName) cfg.fileName.textContent = `${file.name} (${Math.round(file.size / 1024)} Ko)`;
}

function resetFormDemande(suffix) {
  const cfg = getFormConfig(suffix);
  preuveFichiers[suffix] = null;
  if (cfg.competence) cfg.competence.value = "";
  if (cfg.message) cfg.message.value = "";
  if (cfg.file) cfg.file.value = "";
  if (cfg.fileName) cfg.fileName.textContent = "";
}

async function soumettreDemande(suffix, ev) {
  ev.preventDefault();
  if (!currentUser || !currentProfil) return;

  const cfg = getFormConfig(suffix);
  const formateurId = cfg.formateur?.value;
  if (!formateurId) {
    toast("Choisissez un formateur.", "error");
    return;
  }

  const domaine = cfg.domaine?.value || "";
  const niveau = cfg.niveau?.value || "";
  const message = cfg.message?.value?.trim() || "";
  const competence = cfg.competence?.value?.trim() || "";
  const fichier = preuveFichiers[suffix];

  try {
    const res = await envoyerDemande({
      apprenantId: currentUser.uid,
      apprenantNom: currentProfil.nom || "",
      apprenantEmail: currentProfil.email || "",
      apprenantWallet: currentProfil.wallet || "",
      formateurId,
      domaine,
      niveau,
      message,
      competence,
      preuveNom: fichier ? fichier.name : "",
      preuveTaille: fichier ? fichier.size : null,
      preuveType: fichier ? fichier.type : "",
    });
    if (!res.succes) {
      toast(res.erreur || "Échec de l’envoi.", "error");
      return;
    }
    toast("Demande envoyée.", "success");
    resetFormDemande(suffix);
  } catch (e) {
    console.error(e);
    toast(e.message || "Erreur réseau.", "error");
  }
}

function initDemandeForms() {
  const ids = {
    dashboard: "form-demande-dashboard",
    mobile: "form-demande-mobile",
    tab: "form-demande-tab",
  };
  Object.entries(ids).forEach(([suffix, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("submit", (e) => soumettreDemande(suffix, e));
    setupDragDrop(suffix);
  });
}

// ── Navigation ─────────────────────────────────────────────

function setDashRightPanelVisible(show) {
  const p = document.getElementById("dash-right-panel");
  if (!p) return;
  p.classList.toggle("hidden", !show);
}

function showPage(pageId) {
  currentPage = pageId;
  document.querySelectorAll(".page-section").forEach((sec) => {
    const id = sec.getAttribute("data-page-id");
    sec.classList.toggle("hidden", id !== pageId);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    const id = link.getAttribute("data-page");
    const active = id === pageId;
    link.setAttribute("aria-current", active ? "page" : "false");
    if (active) {
      link.classList.add("text-primary-400", "bg-slate-800/80", "border-primary-600");
      link.classList.remove("text-slate-300", "border-transparent");
    } else {
      link.classList.remove("text-primary-400", "bg-slate-800/80", "border-primary-600");
      link.classList.add("text-slate-300", "border-transparent");
    }
  });

  const lg = window.matchMedia("(min-width: 1024px)").matches;
  setDashRightPanelVisible(pageId === "dashboard" && lg);

  if (pageId === "badges") renderGrillesBadges();
  if (pageId === "demandes") renderListeDemandes();
  if (pageId === "historique") renderHistorique();
  if (pageId === "profil") remplirProfilUi();
}

function closeMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const back = document.getElementById("mobile-drawer-backdrop");
  const btn = document.getElementById("btn-open-drawer");
  if (drawer) {
    drawer.classList.add("-translate-x-full");
    drawer.hidden = true;
  }
  back?.classList.add("hidden");
  btn?.setAttribute("aria-expanded", "false");
}

function openMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const back = document.getElementById("mobile-drawer-backdrop");
  const btn = document.getElementById("btn-open-drawer");
  if (drawer) {
    drawer.hidden = false;
    drawer.classList.remove("-translate-x-full");
  }
  back?.classList.remove("hidden");
  btn?.setAttribute("aria-expanded", "true");
}

// ── Profil UI ───────────────────────────────────────────────

function remplirProfilUi() {
  if (!currentProfil) return;
  const n = document.getElementById("profil-nom");
  const e = document.getElementById("profil-email");
  const o = document.getElementById("profil-org");
  const w = document.getElementById("profil-wallet-address");
  const st = document.getElementById("profil-wallet-status");
  if (n) n.value = currentProfil.nom || "";
  if (e) e.value = currentProfil.email || "";
  if (o) o.value = currentProfil.organisation || "";
  const addr = currentProfil.wallet || "";
  if (w) w.textContent = addr || "—";
  const ok = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (st) {
    if (ok) {
      st.textContent = "Wallet enregistré sur le compte";
      st.className = "text-sm text-emerald-400 mb-4";
    } else {
      st.textContent = "Non connecté ou adresse invalide";
      st.className = "text-sm text-amber-400 mb-4";
    }
  }
}

// ── Wallet (navbar + profil) ──────────────────────────────

async function connecterEtEnregistrerWallet() {
  if (!currentUser) return;
  const btnNav = document.getElementById("btn-wallet");
  const btnProfil = document.getElementById("btn-profil-wallet");
  const busy = [btnNav, btnProfil].filter(Boolean);
  busy.forEach((b) => {
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
  });
  if (btnNav) btnNav.textContent = "Connexion…";
  if (btnProfil) btnProfil.textContent = "Connexion…";

  try {
    const addr = await connectWallet();
    if (!addr || typeof addr !== "string") {
      toast("Connexion MetaMask incomplète. Réessayez.", "error");
      return;
    }
    const res = await lierWallet(currentUser.uid, addr);
    if (!res.succes) {
      toast(res.erreur || "Impossible d’enregistrer le wallet.", "error");
      return;
    }
    currentProfil = await getProfil(currentUser.uid);
    mettreAJourBarreWallet();
    remplirProfilUi();
    syncEmailsDemande();
    toast("Wallet enregistré sur Polygon Amoy.", "success");
    mettreAJourStats();
    if (currentPage === "historique") renderHistorique();
  } catch (e) {
    console.error(e);
    toast(e?.message || "Erreur Web3.", "error");
  } finally {
    busy.forEach((b) => {
      b.removeAttribute("aria-busy");
    });
    mettreAJourBarreWallet();
  }
}

function mettreAJourBarreWallet() {
  const btnNav = document.getElementById("btn-wallet");
  const btnProfil = document.getElementById("btn-profil-wallet");
  const span = document.getElementById("wallet-truncated");
  const addr = currentProfil?.wallet || "";
  const ok = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (span) {
    span.textContent = ok ? tronquerAdresse(addr) : "";
    span.classList.toggle("hidden", !ok);
  }
  if (btnNav) {
    if (ok) {
      btnNav.textContent = "Wallet lié";
      btnNav.disabled = true;
      btnNav.classList.add("opacity-60", "cursor-not-allowed");
      btnNav.setAttribute("aria-disabled", "true");
    } else {
      btnNav.textContent = "Connecter Wallet";
      btnNav.disabled = false;
      btnNav.classList.remove("opacity-60", "cursor-not-allowed");
      btnNav.removeAttribute("aria-disabled");
    }
  }
  if (btnProfil) {
    btnProfil.textContent = ok ? "Mettre à jour le wallet" : "Connecter MetaMask";
    btnProfil.disabled = false;
    btnProfil.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

// ── Rafraîchissement global ─────────────────────────────────

function onDataChanged() {
  mettreAJourStats();
  renderGrillesBadges();
  renderListeDemandes();
  if (currentPage === "historique") renderHistorique();
}

// ── Tabs demandes ───────────────────────────────────────────

function setupDemandeTabs() {
  const t1 = document.getElementById("tab-demandes-envoyees");
  const t2 = document.getElementById("tab-demandes-nouvelle");
  const p1 = document.getElementById("panel-demandes-liste");
  const p2 = document.getElementById("panel-demandes-form");
  if (!t1 || !t2 || !p1 || !p2) return;

  const activer = (liste) => {
    if (liste) {
      t1.setAttribute("aria-selected", "true");
      t2.setAttribute("aria-selected", "false");
      t1.classList.add("border-primary-600", "text-primary-400");
      t1.classList.remove("border-transparent", "text-slate-400");
      t2.classList.remove("border-primary-600", "text-primary-400");
      t2.classList.add("border-transparent", "text-slate-400");
      p1.classList.remove("hidden");
      p2.classList.add("hidden");
    } else {
      t1.setAttribute("aria-selected", "false");
      t2.setAttribute("aria-selected", "true");
      t2.classList.add("border-primary-600", "text-primary-400");
      t2.classList.remove("border-transparent", "text-slate-400");
      t1.classList.remove("border-primary-600", "text-primary-400");
      t1.classList.add("border-transparent", "text-slate-400");
      p1.classList.add("hidden");
      p2.classList.remove("hidden");
    }
  };

  t1.addEventListener("click", () => activer(true));
  t2.addEventListener("click", () => activer(false));
}

// ── Init ───────────────────────────────────────────────────

function cleanupListeners() {
  unsubscribers.forEach((u) => {
    try {
      if (typeof u === "function") u();
    } catch (_) {}
  });
  unsubscribers = [];
}

function wireNavigation() {
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) {
        showPage(page);
        if (btn.getAttribute("data-close-drawer") === "true") closeMobileDrawer();
      }
    });
  });

  document.getElementById("btn-open-drawer")?.addEventListener("click", () => {
    const drawer = document.getElementById("mobile-drawer");
    if (drawer?.hidden) openMobileDrawer();
    else closeMobileDrawer();
  });
  document.getElementById("mobile-drawer-backdrop")?.addEventListener("click", closeMobileDrawer);

  document.getElementById("btn-sidebar-collapse")?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
    const pressed = document.body.classList.contains("sidebar-collapsed");
    document.getElementById("btn-sidebar-collapse")?.setAttribute("aria-pressed", pressed ? "true" : "false");
  });

  const goLogin = async () => {
    await deconnecter();
    window.location.href = "login.html";
  };
  document.getElementById("btn-logout")?.addEventListener("click", goLogin);
  document.getElementById("btn-logout-mobile")?.addEventListener("click", goLogin);

  document.getElementById("btn-wallet")?.addEventListener("click", connecterEtEnregistrerWallet);
  document.getElementById("btn-profil-wallet")?.addEventListener("click", connecterEtEnregistrerWallet);

  document.getElementById("btn-share-whatsapp")?.addEventListener("click", partagerWhatsAppPortfolio);

  document.getElementById("filter-domaine")?.addEventListener("change", renderGrillesBadges);
  document.getElementById("filter-niveau")?.addEventListener("change", renderGrillesBadges);
  document.getElementById("filter-search")?.addEventListener("input", renderGrillesBadges);

  document.getElementById("hist-date-de")?.addEventListener("change", renderHistorique);
  document.getElementById("hist-date-a")?.addEventListener("change", renderHistorique);
  document.getElementById("btn-hist-reset")?.addEventListener("click", () => {
    const a = document.getElementById("hist-date-de");
    const b = document.getElementById("hist-date-a");
    if (a) a.value = "";
    if (b) b.value = "";
    renderHistorique();
  });

  document.getElementById("form-profil")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!currentUser) return;
    const nom = document.getElementById("profil-nom")?.value?.trim() || "";
    const organisation = document.getElementById("profil-org")?.value?.trim() || "";
    try {
      const res = await mettreAJourProfil(currentUser.uid, { nom, organisation });
      if (!res.succes) {
        toast(res.erreur || "Mise à jour impossible.", "error");
        return;
      }
      currentProfil = await getProfil(currentUser.uid);
      document.getElementById("user-name").textContent = currentProfil?.nom || "—";
      document.getElementById("user-avatar").textContent = initiales(currentProfil?.nom);
      toast("Profil mis à jour.", "success");
      mettreAJourStats();
    } catch (e) {
      toast(e.message || "Erreur", "error");
    }
  });

  document.getElementById("modal-btn-close")?.addEventListener("click", fermerModalBadge);
  document.getElementById("badge-modal")?.addEventListener("cancel", fermerModalBadge);
  document.getElementById("modal-btn-share")?.addEventListener("click", () => {
    if (selectedBadge) partagerBadge(selectedBadge);
  });
  document.getElementById("modal-btn-pdf")?.addEventListener("click", () => {
    window.print();
  });

  window.addEventListener("resize", () => {
    if (currentPage === "dashboard") {
      const lg = window.matchMedia("(min-width: 1024px)").matches;
      setDashRightPanelVisible(lg);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setGlobalLoading(true);

  remplirSelectsGlobaux();
  initDemandeForms();
  setupDemandeTabs();
  wireNavigation();

  const unsub = observerConnexion(async (user, profil) => {
    cleanupListeners();

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!profil || profil.role !== "apprenant") {
      toast("Accès réservé aux apprenants.", "error");
      window.location.href = "dashboard.html";
      return;
    }

    currentUser = user;
    currentProfil = profil;

    document.getElementById("user-name").textContent = profil.nom || "—";
    document.getElementById("user-avatar").textContent = initiales(profil.nom);

    await chargerFormateurs();
    remplirSelectsGlobaux();
    syncEmailsDemande();

    mettreAJourBarreWallet();

    try {
      const cid = await lireChainIdMetaMask();
      if (cid != null && cid !== 80002n) {
        toast(
          "MetaMask n’est pas sur Polygon Amoy (chain ID 80002). Utilisez « Connecter Wallet » pour basculer ou ajouter le réseau.",
          "info"
        );
      }
    } catch (_) {
      /* silencieux : pas d’extension ou eth_chainId indisponible */
    }

    try {
      const unsubB = ecouterBadgesApprenant(user.uid, (list) => {
        badgesData = list;
        onDataChanged();
      });
      unsubscribers.push(unsubB);

      const unsubD = ecouterDemandesApprenant(user.uid, (list) => {
        demandesData = list;
        onDataChanged();
      });
      unsubscribers.push(unsubD);
    } catch (e) {
      console.error(e);
      toast("Erreur d’écoute temps réel.", "error");
    }

    showPage("dashboard");
    setGlobalLoading(false);
  });
});
