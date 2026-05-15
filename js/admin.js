// ============================================================
//  admin.js — Logique interface d'administration SkillBadge
//  Auth simplifiée (Phase 3) + gestion des formateurs en attente
// ============================================================

import {
  ref,
  get,
  update,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { envoyerEmailApprobation } from "./email.js";

// ─────────────────────────────────────────────────────────
//  CONFIGURATION ADMIN (Phase 3 — hardcoded pour la démo)
//  ⚠️ Pour la production : utiliser Firebase Custom Claims
// ─────────────────────────────────────────────────────────
const ADMIN_CONFIG = {
  email: "dankfd99@gmail.com",   // ← Remplacer par votre email
  password: "SkillBadge2026!",       // ← Remplacer par votre mot de passe
};

// ─────────────────────────────────────────────────────────
//  ÉTAT GLOBAL
// ─────────────────────────────────────────────────────────
let adminUid = null;
let currentSection = "sec-demandes";
let unsubscribeListeners = [];

// ─────────────────────────────────────────────────────────
//  INITIALISATION AU CHARGEMENT
// ─────────────────────────────────────────────────────────
export function initAdmin() {
  const loginPanel = document.getElementById("login-panel");
  const dashPanel = document.getElementById("dash-panel");

  // Vérifier si déjà authentifié (session Firebase persistante)
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Vérifier que c'est bien l'admin via sessionStorage ET le bon uid
      const sessionOk = sessionStorage.getItem("adminConnected") === "true";
      if (sessionOk || user.email === ADMIN_CONFIG.email) {
        adminUid = user.uid;
        sessionStorage.setItem("adminConnected", "true");
        loginPanel?.classList.add("hidden");
        dashPanel?.classList.remove("hidden");
        chargerDashboard();
      } else {
        // Connecté mais pas admin → déconnecter
        await signOut(auth);
        afficherLoginPanel();
      }
    } else {
      afficherLoginPanel();
    }
  });
}

function afficherLoginPanel() {
  document.getElementById("login-panel")?.classList.remove("hidden");
  document.getElementById("dash-panel")?.classList.add("hidden");
}

// ─────────────────────────────────────────────────────────
//  CONNEXION ADMIN
// ─────────────────────────────────────────────────────────
export async function loginAdmin(email, password) {
  const errDiv = document.getElementById("login-error");

  // Vérification hardcoded Phase 3
  if (email !== ADMIN_CONFIG.email || password !== ADMIN_CONFIG.password) {
    afficherErreurLogin("Identifiants administrateur invalides.");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    adminUid = cred.user.uid;
    sessionStorage.setItem("adminConnected", "true");
    document.getElementById("login-panel").classList.add("hidden");
    document.getElementById("dash-panel").classList.remove("hidden");
    chargerDashboard();
  } catch (e) {
    // Essai avec Firebase (si le compte existe)
    afficherErreurLogin("Connexion Firebase échouée. Vérifiez vos identifiants.");
    console.error(e);
  }
}

function afficherErreurLogin(msg) {
  const el = document.getElementById("login-error");
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}

// ─────────────────────────────────────────────────────────
//  DÉCONNEXION
// ─────────────────────────────────────────────────────────
export async function logoutAdmin() {
  unsubscribeListeners.forEach(fn => fn());
  unsubscribeListeners = [];
  sessionStorage.removeItem("adminConnected");
  await signOut(auth);
  afficherLoginPanel();
}

// ─────────────────────────────────────────────────────────
//  CHARGER LE DASHBOARD
// ─────────────────────────────────────────────────────────
function chargerDashboard() {
  chargerStats();
  ecouterDemandesEnAttente();
  chargerTousUtilisateurs();
  chargerBadgesStats();
  showSection(currentSection);
}

// ─────────────────────────────────────────────────────────
//  NAVIGATION ENTRE SECTIONS
// ─────────────────────────────────────────────────────────
export function showSection(sectionId) {
  currentSection = sectionId;
  document.querySelectorAll(".page-sec").forEach(s => s.classList.add("hidden"));
  document.getElementById(sectionId)?.classList.remove("hidden");

  // Mettre à jour la sidebar
  document.querySelectorAll(".nav-item").forEach(btn => {
    const isActive = btn.dataset.section === sectionId;
    btn.classList.toggle("bg-blue-600/20", isActive);
    btn.classList.toggle("text-blue-400", isActive);
    btn.classList.toggle("border-blue-500", isActive);
    btn.classList.toggle("text-slate-300", !isActive);
    btn.classList.toggle("border-transparent", !isActive);
  });
}

// ─────────────────────────────────────────────────────────
//  STATISTIQUES GLOBALES
// ─────────────────────────────────────────────────────────
async function chargerStats() {
  try {
    const [snapUsers, snapBadges] = await Promise.all([
      get(ref(db, "utilisateurs")),
      get(ref(db, "badges")),
    ]);

    const users = snapUsers.exists() ? Object.values(snapUsers.val()) : [];
    const badges = snapBadges.exists() ? Object.values(snapBadges.val()) : [];

    const formateurs = users.filter(u => u.role === "formateur");
    const approuves = formateurs.filter(u => u.statut === "approuve");
    const enAttente = formateurs.filter(u => u.statut === "en_attente");
    const apprenants = users.filter(u => u.role === "apprenant");

    setStatEl("stat-total-users", users.length);
    setStatEl("stat-formateurs", formateurs.length);
    setStatEl("stat-approuves", approuves.length);
    setStatEl("stat-en-attente", enAttente.length);
    setStatEl("stat-apprenants", apprenants.length);
    setStatEl("stat-badges", badges.length);

    // Badge compteur dans la sidebar
    const badge = document.getElementById("badge-count");
    if (badge) {
      badge.textContent = enAttente.length;
      badge.classList.toggle("hidden", enAttente.length === 0);
    }
  } catch (e) {
    console.error("Erreur stats :", e);
  }
}

function setStatEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─────────────────────────────────────────────────────────
//  ÉCOUTER EN TEMPS RÉEL LES DEMANDES EN ATTENTE
// ─────────────────────────────────────────────────────────
function ecouterDemandesEnAttente() {
  const unsub = onValue(ref(db, "utilisateurs"), (snapshot) => {
    if (!snapshot.exists()) {
      renderDemandesVides();
      return;
    }
    const all = snapshot.val();
    const enAttente = Object.entries(all)
      .filter(([, u]) => u.role === "formateur" && u.statut === "en_attente")
      .map(([uid, u]) => ({ uid, ...u }))
      .sort((a, b) => b.createdAt - a.createdAt);

    renderDemandes(enAttente);

    // Mettre à jour le badge sidebar
    const badge = document.getElementById("badge-count");
    if (badge) {
      badge.textContent = enAttente.length;
      badge.classList.toggle("hidden", enAttente.length === 0);
    }

    // Mettre à jour les stats aussi
    chargerStats();
  });
  unsubscribeListeners.push(unsub);
}

function renderDemandesVides() {
  const tbody = document.getElementById("demandes-tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-12 text-center text-slate-500">
          <div class="flex flex-col items-center gap-2">
            <svg class="h-10 w-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-sm">Aucune demande en attente 🎉</p>
          </div>
        </td>
      </tr>
    `;
  }
}

function renderDemandes(formateurs) {
  const tbody = document.getElementById("demandes-tbody");
  if (!tbody) return;

  if (formateurs.length === 0) {
    renderDemandesVides();
    return;
  }

  tbody.innerHTML = formateurs.map(f => `
    <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors" id="row-${f.uid}">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            ${(f.nom || "?")[0].toUpperCase()}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-100 truncate">${escHtml(f.nom || "—")}</p>
            <p class="text-xs text-slate-400 truncate">${escHtml(f.email || "—")}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">${escHtml(f.organisation || "Indépendant")}</td>
      <td class="px-4 py-3">
        ${f.portfolioUrl ? `<a href="${escHtml(f.portfolioUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2 transition">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          Portfolio
        </a>` : '<span class="text-xs text-slate-600">—</span>'}
      </td>
      <td class="px-4 py-3 text-xs text-slate-400 max-w-[180px]">
        <p class="truncate" title="${escHtml(f.preuveSociale || '')}">${escHtml(f.preuveSociale || "—")}</p>
      </td>
      <td class="px-4 py-3 text-xs text-slate-400">${escHtml(f.adresseCentre || "—")}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${formatDate(f.createdAt)}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <button type="button"
                  onclick="window.adminAction('approuver', '${f.uid}', '${escHtml(f.email)}', '${escHtml(f.nom)}')"
                  class="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-600/50 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-600/40 hover:scale-[1.02]">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            Approuver
          </button>
          <button type="button"
                  onclick="window.adminAction('refuser', '${f.uid}', '${escHtml(f.email)}', '${escHtml(f.nom)}')"
                  class="inline-flex items-center gap-1 rounded-lg bg-red-600/20 border border-red-600/50 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-600/40 hover:scale-[1.02]">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            Refuser
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ─────────────────────────────────────────────────────────
//  ACTION ADMIN : APPROUVER OU REFUSER
// ─────────────────────────────────────────────────────────
export async function adminAction(action, uid, email, nom) {
  const estApprouve = action === "approuver";
  const statut = estApprouve ? "approuve" : "refuse";

  // Confirmation pour le refus
  if (!estApprouve) {
    const raison = prompt(`Raison du refus pour ${nom} (optionnel) :`);
    if (raison === null) return; // Annulé
    await executerAction(uid, email, nom, statut, raison || "");
  } else {
    await executerAction(uid, email, nom, statut, "");
  }
}

async function executerAction(uid, email, nom, statut, raison) {
  const row = document.getElementById(`row-${uid}`);
  if (row) row.style.opacity = "0.5";

  afficherToast("Traitement en cours…", "info");

  try {
    // 1. Mettre à jour Firebase
    const updateData = {
      statut,
      approuvePar: adminUid,
      updatedAt: Date.now(),
    };
    if (statut === "refuse" && raison) {
      updateData.refusRaison = raison;
    }
    await update(ref(db, `utilisateurs/${uid}`), updateData);

    // 2. Envoyer email (avec fallback si EmailJS pas configuré)
    const emailResult = await envoyerEmailApprobation({ toEmail: email, nom, statut, raison });
    if (!emailResult.succes) {
      console.warn("Email non envoyé :", emailResult.erreur);
    }

    const msg = statut === "approuve"
      ? `✅ ${nom} est maintenant approuvé${emailResult.succes ? " · Email envoyé" : " · Email non envoyé (configurer EmailJS)"}`
      : `🚫 Demande de ${nom} refusée${emailResult.succes ? " · Email envoyé" : " · Email non envoyé (configurer EmailJS)"}`;

    afficherToast(msg, statut === "approuve" ? "success" : "warning");

  } catch (e) {
    console.error("Erreur action admin :", e);
    afficherToast("❌ Erreur : " + e.message, "error");
    if (row) row.style.opacity = "1";
  }
}

// ─────────────────────────────────────────────────────────
//  CHARGER TOUS LES UTILISATEURS
// ─────────────────────────────────────────────────────────
async function chargerTousUtilisateurs() {
  const unsub = onValue(ref(db, "utilisateurs"), (snapshot) => {
    const tbody = document.getElementById("users-tbody");
    if (!tbody) return;

    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">Aucun utilisateur</td></tr>`;
      return;
    }

    const all = Object.entries(snapshot.val())
      .map(([uid, u]) => ({ uid, ...u }))
      .sort((a, b) => b.createdAt - a.createdAt);

    const roleFilter = document.getElementById("filter-role")?.value || "tous";
    const filtered = roleFilter === "tous" ? all : all.filter(u => u.role === roleFilter);

    tbody.innerHTML = filtered.map(u => `
      <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              ${(u.nom || "?")[0].toUpperCase()}
            </div>
            <span class="text-sm text-slate-200 truncate">${escHtml(u.nom || "—")}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-400">${escHtml(u.email || "—")}</td>
        <td class="px-4 py-3">
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleCss(u.role)}">
            ${escHtml(u.role || "—")}
          </span>
        </td>
        <td class="px-4 py-3">
          ${u.statut ? `<span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statutCss(u.statut)}">${escHtml(u.statut)}</span>` : '<span class="text-xs text-slate-600">—</span>'}
        </td>
        <td class="px-4 py-3 font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title="${escHtml(u.wallet || '')}">
          ${u.wallet ? u.wallet.slice(0, 10) + "…" : "—"}
        </td>
        <td class="px-4 py-3 text-xs text-slate-500">${formatDate(u.createdAt)}</td>
      </tr>
    `).join("");

    // Mettre à jour le compteur
    document.getElementById("users-count") && (document.getElementById("users-count").textContent = `${filtered.length} utilisateur${filtered.length > 1 ? "s" : ""}`);
  });
  unsubscribeListeners.push(unsub);
}

// ─────────────────────────────────────────────────────────
//  STATS BADGES
// ─────────────────────────────────────────────────────────
async function chargerBadgesStats() {
  const snap = await get(ref(db, "badges"));
  if (!snap.exists()) return;

  const badges = Object.values(snap.val());
  const parDomaine = {};
  badges.forEach(b => {
    parDomaine[b.domaine] = (parDomaine[b.domaine] || 0) + 1;
  });

  const container = document.getElementById("badges-chart");
  if (!container) return;

  const sorted = Object.entries(parDomaine).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([domaine, count]) => `
    <div class="flex items-center gap-3">
      <span class="text-xs text-slate-400 w-36 shrink-0 truncate">${escHtml(domaine)}</span>
      <div class="flex-1 rounded-full bg-slate-700 h-2 overflow-hidden">
        <div class="h-2 rounded-full bg-primary-500 transition-all duration-700"
             style="width:${Math.round((count / max) * 100)}%"></div>
      </div>
      <span class="text-xs font-semibold text-slate-300 w-6 text-right">${count}</span>
    </div>
  `).join("");
}

// ─────────────────────────────────────────────────────────
//  FILTRAGE UTILISATEURS
// ─────────────────────────────────────────────────────────
export function filtrerUtilisateurs() {
  chargerTousUtilisateurs();
}

// ─────────────────────────────────────────────────────────
//  TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────
function afficherToast(message, type = "info") {
  const toast = document.getElementById("admin-toast");
  const msg = document.getElementById("admin-toast-msg");
  if (!toast || !msg) return;

  const styles = {
    success: "bg-emerald-900/90 border-emerald-600 text-emerald-200",
    error: "bg-red-900/90 border-red-600 text-red-200",
    warning: "bg-amber-900/90 border-amber-600 text-amber-200",
    info: "bg-slate-800/90 border-slate-600 text-slate-200",
  };

  toast.className = `fixed top-20 right-4 z-[200] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-xl transition-all duration-300 ${styles[type] || styles.info}`;
  msg.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
  }, 5000);
}

// ─────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
}

function roleCss(role) {
  const map = {
    formateur: "bg-blue-500/15 text-blue-300",
    apprenant: "bg-purple-500/15 text-purple-300",
    recruteur: "bg-teal-500/15 text-teal-300",
    admin: "bg-amber-500/15 text-amber-300",
  };
  return map[role] || "bg-slate-700 text-slate-300";
}

function statutCss(statut) {
  const map = {
    en_attente: "bg-amber-500/20 text-amber-300",
    approuve: "bg-emerald-500/20 text-emerald-300",
    refuse: "bg-red-500/20 text-red-300",
  };
  return map[statut] || "bg-slate-700 text-slate-400";
}

// Exposer les fonctions au niveau global pour les onclick HTML
window.adminAction = adminAction;
window.showSection = showSection;
window.filtrerUtilisateurs = filtrerUtilisateurs;
