// ============================================================
//  formateur.js — Espace formateur SkillBadge (dark + auth guard)
//  Étapes 1–3, historique, demandes temps réel (Firebase + Web3)
// ============================================================

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import {
  observerConnexion,
  getProfil,
  deconnecter,
  lierWallet,
} from "./auth.js";
import {
  creerTypeBadge,
  attribuerBadge,
  getBadgesFormateur,
  formaterDate,
  couleurNiveau,
  couleurDomaine,
} from "./badges.js";
import {
  ecouterDemandesFormateur,
  mettreAJourStatutDemande,
} from "./demandes.js";
import {
  connectWallet,
  traduireErreurWeb3,
} from "./web3.js";

// ── Mapping domaine/niveau → nom de fichier image badge ───
const BADGE_IMAGES = {
  "Développement Web": {
    "Débutant": "web-debutant.png",
    "Intermédiaire": "web-intermediaire.png",
    "Avancé": "web-avance.png",
    "Expert": "web-expert.png",
  },
  "Développement Mobile": {
    "Débutant": "mobile-debutant.png",
    "Intermédiaire": "mobile-intermediaire.png",
    "Avancé": "mobile-avance.png",
    "Expert": "mobile-expert.png",
  },
  "Data & IA": {
    "Débutant": "data-debutant.png",
    "Intermédiaire": "data-intermediaire.png",
    "Avancé": "data-avance.png",
    "Expert": "data-expert.png",
  },
  "Cybersécurité": {
    "Débutant": "cyber-debutant.png",
    "Intermédiaire": "cyber-intermediaire.png",
    "Avancé": "cyber-avance.png",
    "Expert": "cyber-expert.png",
  },
  "UI/UX Design": {
    "Débutant": "design-debutant.png",
    "Intermédiaire": "design-intermediaire.png",
    "Avancé": "design-avance.png",
    "Expert": "design-expert.png",
  },
  "DevOps": {
    "Débutant": "devops-debutant.png",
    "Intermédiaire": "devops-intermediaire.png",
    "Avancé": "devops-avance.png",
    "Expert": "devops-expert.png",
  },
  "Blockchain": {
    "Débutant": "web-debutant.png",
    "Intermédiaire": "web-intermediaire.png",
    "Avancé": "web-avance.png",
    "Expert": "web-expert.png",
  },
  "Marketing Digital": {
    "Débutant": "design-debutant.png",
    "Intermédiaire": "design-intermediaire.png",
    "Avancé": "design-avance.png",
    "Expert": "design-expert.png",
  },
};

/**
 * Retourne le chemin relatif de l'image badge pour un domaine/niveau donnés.
 * Utilise public/images/badges/ comme dossier racine.
 */
function getBadgeImagePath(domaine, niveau) {
  const fichier = BADGE_IMAGES[domaine]?.[niveau];
  if (!fichier) return null;
  return `public/images/badges/${fichier}`;
}

// ── État global ───────────────────────────────────────────
let currentFormateur = null;
let badgeTypeCreated = null;
let selectedApprenant = null;
let unsubDemandes = null;
let currentDemandes = []; // Stockage local des demandes filtrées

// ── UI : toast ─────────────────────────────────────────────
function toast(msg, type = "info") {
  const el = document.getElementById("toast-formateur");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden", "border-emerald-600", "bg-emerald-900/90", "text-emerald-100", "border-red-600", "bg-red-900/90", "text-red-100", "border-slate-600", "bg-slate-800/95", "text-slate-100");
  if (type === "error") {
    el.classList.add("border-red-600", "bg-red-900/90", "text-red-100");
  } else if (type === "success") {
    el.classList.add("border-emerald-600", "bg-emerald-900/90", "text-emerald-100");
  } else {
    el.classList.add("border-slate-600", "bg-slate-800/95", "text-slate-100");
  }
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 4000);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function setAuthLoading(show) {
  const el = document.getElementById("global-auth-loading");
  if (el) el.classList.toggle("hidden", !show);
}

function showAppShell(show) {
  const el = document.getElementById("app-shell");
  if (el) el.classList.toggle("hidden", !show);
}

// ── Auth guard + redirection par rôle ──────────────────────
function redirigerSelonRole(profil) {
  if (!profil) return;
  const r = profil.role;
  if (r === "apprenant") {
    window.location.href = "portfolio.html";
    return;
  }
  if (r === "recruteur") {
    window.location.href = "verify.html";
    return;
  }
  window.location.href = "dashboard.html";
}

function initiales(nom) {
  if (!nom || typeof nom !== "string") return "?";
  const p = nom.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Navigation sections ────────────────────────────────────
function showSection(sectionId) {
  document.querySelectorAll(".page-sec").forEach((sec) => {
    sec.classList.toggle("hidden", sec.id !== sectionId);
  });
  document.querySelectorAll(".nav-item-desktop").forEach((btn) => {
    const target = btn.getAttribute("data-section");
    const active = target === sectionId;
    btn.classList.toggle("border-primary-600", active);
    btn.classList.toggle("bg-blue-600/20", active);
    btn.classList.toggle("text-blue-400", active);
    btn.classList.toggle("font-semibold", active);
    btn.classList.toggle("border-transparent", !active);
    btn.classList.toggle("text-slate-300", !active);
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const target = btn.getAttribute("data-section");
    const active = target === sectionId;
    btn.classList.toggle("bg-slate-800", active);
    btn.classList.toggle("text-primary-400", active);
    btn.classList.toggle("font-semibold", active);
    btn.classList.toggle("text-slate-300", !active);
  });
  if (sectionId === "sec-historique") window.chargerHistorique?.();
}

// ── Étapes 1–3 ─────────────────────────────────────────────
function showStep(stepNum) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`step-content-${i}`);
    if (el) el.classList.toggle("hidden", i !== stepNum);
  }
  for (let i = 1; i <= 3; i++) {
    const numEl = document.getElementById(`snum${i}`);
    const lblEl = document.getElementById(`slbl${i}`);
    if (!numEl || !lblEl) continue;
    numEl.className =
      "step-num flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ";
    lblEl.className = "step-lbl text-xs font-medium ";
    if (i < stepNum) {
      numEl.className += "bg-emerald-600 text-white";
      numEl.textContent = "✓";
      lblEl.className += "text-slate-500";
    } else if (i === stepNum) {
      numEl.className += "bg-primary-600 text-white";
      numEl.textContent = String(i);
      lblEl.className += "text-primary-400";
    } else {
      numEl.className += "bg-slate-600 text-slate-400";
      numEl.textContent = String(i);
      lblEl.className += "text-slate-600";
    }
  }
}

function setupStepNavigation() {
  window.showStep = showStep;
  window.showSection = showSection;

  window.selNiveau = function (niveau) {
    const hidden = document.getElementById("f-niveau");
    if (hidden) hidden.value = niveau;
    document.querySelectorAll(".niveau-btn").forEach((btn) => {
      btn.classList.toggle("ring-2", btn.dataset.n === niveau);
      btn.classList.toggle("ring-primary-500", btn.dataset.n === niveau);
    });
    window.mettreAJourApercu();
  };

  document.querySelectorAll(".niveau-btn").forEach((btn) => {
    btn.addEventListener("click", () => window.selNiveau(btn.dataset.n));
  });
}

window.mettreAJourApercu = function () {
  const domaine = document.getElementById("f-domaine")?.value || "";
  const competence =
    document.getElementById("f-competence")?.value || "Compétence";
  const niveau = document.getElementById("f-niveau")?.value || "";

  const pd = document.getElementById("prev-domaine");
  const pc = document.getElementById("prev-comp");
  const pn = document.getElementById("prev-niveau");
  const hex = document.getElementById("prev-hex");

  if (pd) pd.textContent = domaine || "Domaine";
  if (pc) pc.textContent = competence || "Compétence";
  if (pn) {
    pn.textContent = niveau || "Niveau";
    if (niveau) {
      const c = couleurNiveau(niveau);
      pn.style.background = c.bg;
      pn.style.color = c.color;
    } else {
      pn.style.background = "";
      pn.style.color = "";
    }
  }

  // ── Aperçu image du badge ─────────────────────────────────
  if (hex) {
    const imgPath = (domaine && niveau) ? getBadgeImagePath(domaine, niveau) : null;

    if (imgPath) {
      // Afficher l'image réelle du badge (avec fallback si 404)
      hex.style.background = "";
      hex.style.clipPath = "";
      hex.innerHTML = `
        <img
          src="${imgPath}"
          alt="Badge ${domaine} ${niveau}"
          class="prev-badge-img"
          style="width:100%;height:100%;object-fit:contain;border-radius:8px;"
          onerror="this.parentElement.style.background='${couleurDomaine(domaine) || '#334155'}';this.parentElement.style.clipPath='polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)';this.remove();"
        />`;
    } else {
      // Aucun couple domaine/niveau → hexagone coloré par défaut
      hex.innerHTML = "";
      hex.style.background = couleurDomaine(domaine) || "#334155";
      hex.style.clipPath = "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)";
    }
  }
};

window.etape1Valider = async function () {
  if (!currentFormateur) return;
  const domaine = document.getElementById("f-domaine")?.value;
  const competence = document.getElementById("f-competence")?.value?.trim();
  const niveau = document.getElementById("f-niveau")?.value;
  const criteres = document.getElementById("f-criteres")?.value || "";
  const validite = document.getElementById("f-validite")?.value;
  const scoreMin = parseInt(document.getElementById("f-score")?.value, 10) || 0;

  if (!competence || !niveau) {
    toast("Renseignez la compétence et le niveau.", "error");
    return;
  }

  const btn = document.getElementById("btn-etape1");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Enregistrement…";
  }

  try {
    const result = await creerTypeBadge({
      nom: competence,
      domaine,
      niveau,
      criteres,
      validite,
      scoreMin,
      formateurId: currentFormateur.uid,
      formateurNom: currentFormateur.nom,
      organisation: currentFormateur.organisation || "",
    });

    if (!result.succes) {
      toast(result.erreur || "Création impossible.", "error");
      return;
    }

    badgeTypeCreated = {
      id: result.id,
      nom: competence,
      domaine,
      niveau,
      validite,
    };

    const recap = document.getElementById("recap-badge");
    if (recap) {
      recap.innerHTML = `<strong class="text-slate-200">${escapeHtml(domaine)}</strong> — ${escapeHtml(competence)} · ${escapeHtml(niveau)}`;
    }

    showStep(2);
    await rechercherApprenant("");
    toast("Type de badge enregistré. Sélectionnez un apprenant.", "success");
  } catch (e) {
    console.error(e);
    toast(e.message || "Erreur inattendue.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Valider et continuer";
    }
  }
};

/**
 * Recherche apprenants (Firebase). Chaîne vide = liste tous les apprenants (limité pratique démo).
 */
window.rechercherApprenant = async function () {
  const queryInput = document.getElementById("search-apprenant");
  const liste = document.getElementById("liste-apprenants");
  if (!liste) return;

  const q = (queryInput?.value || "").trim().toLowerCase();
  if (q.length > 0 && q.length < 2) {
    liste.innerHTML =
      '<p class="p-2 text-xs text-slate-500">Tapez au moins 2 caractères pour filtrer.</p>';
    return;
  }

  liste.innerHTML =
    '<p class="p-2 text-xs text-slate-500">Chargement…</p>';

  try {
    const snapshot = await get(ref(db, "utilisateurs"));
    if (!snapshot.exists()) {
      liste.innerHTML =
        '<p class="p-2 text-xs text-slate-500">Aucun utilisateur.</p>';
      return;
    }

    const entries = Object.entries(snapshot.val());
    let rows = entries.filter(([, u]) => u && u.role === "apprenant");
    if (q.length >= 2) {
      rows = rows.filter(
        ([, u]) =>
          (u.nom && u.nom.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.wallet && String(u.wallet).toLowerCase().includes(q))
      );
    }

    if (!rows.length) {
      liste.innerHTML =
        '<p class="p-2 text-xs text-slate-500">Aucun apprenant trouvé.</p>';
      return;
    }

    liste.innerHTML = "";
    rows.forEach(([uid, u]) => {
      const w = u.wallet || "";
      const wShort =
        w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w || "—";
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.uid = uid;
      card.className =
        "flex w-full items-center gap-3 rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-left transition hover:border-primary-500/60 hover:bg-slate-800";
      card.innerHTML = `
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-primary-300">${escapeHtml(initiales(u.nom))}</div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-white">${escapeHtml(u.nom || "")}</div>
          <div class="truncate text-xs text-slate-400">${escapeHtml(u.email || "")}</div>
          <div class="truncate font-mono text-[10px] text-slate-500">${escapeHtml(wShort)}</div>
        </div>`;
      card.addEventListener("click", () =>
        selectionnerApprenant(uid, u.nom, u.email, u.wallet || "")
      );
      liste.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    liste.innerHTML =
      '<p class="p-2 text-xs text-red-400">Erreur de chargement.</p>';
  }
};

function selectionnerApprenant(uid, nom, email, wallet) {
  selectedApprenant = { uid, nom, email, wallet };
  const liste = document.getElementById("liste-apprenants");
  if (!liste) return;
  liste.querySelectorAll("button[data-uid]").forEach((b) => {
    const on = b.dataset.uid === uid;
    b.classList.toggle("ring-2", on);
    b.classList.toggle("ring-primary-500", on);
    b.classList.toggle("border-primary-500", on);
  });
  toast(`Apprenant sélectionné : ${nom}`, "success");
}

window.etape2Valider = async function () {
  if (!currentFormateur) return;
  if (!badgeTypeCreated || !selectedApprenant) {
    toast("Créez un type de badge puis sélectionnez un apprenant.", "error");
    return;
  }

  const score = parseInt(document.getElementById("a-score")?.value, 10);
  const commentaire = document.getElementById("a-commentaire")?.value || "";
  const validite = document.getElementById("f-validite")?.value;

  if (Number.isNaN(score) || score < 0 || score > 100) {
    toast("Score invalide (0–100).", "error");
    return;
  }

  const btn = document.getElementById("btn-etape2");
  const original = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Émission en cours…";
  }

  const wrap = document.getElementById("conf-polygon-wrap");
  if (wrap) {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
  }

  try {
    const result = await attribuerBadge({
      typeId: badgeTypeCreated.id,
      nom: badgeTypeCreated.nom,
      domaine: badgeTypeCreated.domaine,
      niveau: badgeTypeCreated.niveau,
      apprenantId: selectedApprenant.uid,
      apprenantNom: selectedApprenant.nom,
      apprenantWallet: selectedApprenant.wallet,
      apprenantEmail: selectedApprenant.email || "",
      formateurId: currentFormateur.uid,
      formateurNom: currentFormateur.nom,
      organisation: currentFormateur.organisation || "",
      score,
      commentaire,
      validite,
    });

    if (!result.succes) {
      toast(result.erreur || "Échec de l’attribution.", "error");
      return;
    }

    document.getElementById("conf-badge").textContent =
      `${badgeTypeCreated.nom} — ${badgeTypeCreated.niveau}`;
    document.getElementById("conf-apprenant").textContent =
      selectedApprenant.nom;
    document.getElementById("conf-score").textContent = `${score}/100`;
    document.getElementById("conf-date").textContent =
      new Date().toLocaleDateString("fr-FR");
    const tx = result.txHash || "";
    document.getElementById("conf-nft").textContent = tx
      ? `${tx.slice(0, 12)}…${tx.slice(-8)}`
      : "— (simulation)";
    document.getElementById("conf-bloc").textContent = result.blockchain
      ? "On-chain"
      : "Hors chaîne / démo";

    if (result.blockchain && tx) {
      const w = document.getElementById("conf-polygon-wrap");
      if (w) {
        w.classList.remove("hidden");
        w.innerHTML = `<a href="https://amoy.polygonscan.com/tx/${escapeHtml(tx)}" target="_blank" rel="noopener noreferrer" class="text-primary-400 underline hover:text-primary-300">Voir la transaction sur Polygonscan</a>`;
      }
    }

    showStep(3);
    toast("Badge attribué avec succès.", "success");
    await window.chargerHistorique();
  } catch (e) {
    console.error(e);
    toast(e.message || "Erreur inattendue.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || "Émettre le badge";
    }
  }
};

window.recommencer = function () {
  badgeTypeCreated = null;
  selectedApprenant = null;
  const ids = ["f-competence", "f-criteres", "a-commentaire", "search-apprenant"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.querySelectorAll(".niveau-btn").forEach((btn) => {
    btn.classList.remove("ring-2", "ring-primary-500");
  });
  const fn = document.getElementById("f-niveau");
  if (fn) fn.value = "";
  const liste = document.getElementById("liste-apprenants");
  if (liste) liste.innerHTML = "";
  showStep(1);
  window.mettreAJourApercu();
};

// ── Historique ──────────────────────────────────────────────
window.chargerHistorique = async function () {
  if (!currentFormateur) return;
  const tbody = document.getElementById("hist-tbody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Chargement…</td></tr>';

  try {
    const badges = await getBadgesFormateur(currentFormateur.uid);
    if (!badges.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Aucun badge émis pour le moment.</td></tr>';
      return;
    }

    tbody.innerHTML = badges
      .map((b) => {
        const c = couleurNiveau(b.niveau);
        const chainCell = b.blockchainUsed && b.txHash
          ? `<a href="https://amoy.polygonscan.com/tx/${escapeHtml(b.txHash)}" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline text-xs">Voir tx</a>`
          : '<span class="text-slate-500 text-xs">Démo / Firebase</span>';
        return `<tr class="border-b border-slate-700/80 hover:bg-slate-800/40">
          <td class="px-4 py-3"><span class="text-xs text-slate-500 font-mono">${escapeHtml((b.apprenantWallet || "").slice(0, 10))}…</span><br/><span class="text-slate-200">${escapeHtml(b.apprenantNom || "")}</span></td>
          <td class="px-4 py-3 text-slate-300">${escapeHtml(b.domaine || "")}</td>
          <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-xs font-semibold" style="background:${c.bg};color:${c.color}">${escapeHtml(b.niveau || "")}</span></td>
          <td class="px-4 py-3 text-slate-400 text-xs">${escapeHtml(formaterDate(b.dateEmission))}</td>
          <td class="px-4 py-3">${chainCell}</td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
    tbody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-8 text-center text-red-400">Erreur de chargement.</td></tr>';
  }
};

// ── Demandes temps réel (Version Phase 3 Hardening) ───────────
function getNiveauColor(niveau) {
  const map = {
    "Débutant": "emerald",
    "Intermédiaire": "blue",
    "Avancé": "amber",
    "Expert": "purple"
  };
  return map[niveau] || "slate";
}

/**
 * Vérifie si le formateur peut émettre (MetaMask + Whitelist)
 * Utilisé avant de traiter une demande.
 */
async function checkWalletEmissionEligible() {
  if (!currentFormateur?.wallet) {
    return { ok: false, reason: "Aucun wallet lié à votre compte." };
  }

  try {
    const { checkFormateurWhitelisted } = await import("./web3.js");
    const eth = window.ethereum;
    if (!eth) return { ok: false, reason: "MetaMask non détecté." };

    const accounts = await eth.request({ method: "eth_accounts" });
    const connected = accounts[0];

    if (!connected) return { ok: false, reason: "MetaMask non connecté." };
    if (connected.toLowerCase() !== currentFormateur.wallet.toLowerCase()) {
      return { ok: false, reason: `Mauvais compte MetaMask. Connectez ${currentFormateur.wallet.slice(0, 6)}...` };
    }

    const whitelisted = await checkFormateurWhitelisted(connected);
    if (!whitelisted) return { ok: false, reason: "Votre wallet n'est pas encore whitelisté sur le contrat." };

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "Erreur technique lors de la vérification web3." };
  }
}

function chargerDemandes() {
  if (!currentFormateur?.uid) return;

  const tbody = document.getElementById("demandes-tbody");
  const countBadge = document.getElementById("demandes-count");
  const emptyMsg = document.getElementById("demandes-empty");

  // Mobile count (si présent dans le HTML)
  const mobCount = document.getElementById("dem-count-mobile");
  const deskCount = document.getElementById("dem-count");

  // Désabonnement si déjà actif
  if (typeof unsubDemandes === "function") {
    unsubDemandes();
  }

  unsubDemandes = ecouterDemandesFormateur(currentFormateur.uid, (demandes) => {
    currentDemandes = demandes;

    const nbEnAttente = demandes.filter(d => d.statut === "en_attente").length;
    if (countBadge) countBadge.textContent = nbEnAttente;
    if (deskCount) {
      deskCount.textContent = nbEnAttente;
      deskCount.classList.toggle("hidden", nbEnAttente === 0);
    }
    if (mobCount) {
      mobCount.textContent = nbEnAttente;
      mobCount.classList.toggle("hidden", nbEnAttente === 0);
    }

    if (!tbody) return;

    if (demandes.length === 0) {
      tbody.innerHTML = "";
      if (emptyMsg) emptyMsg.classList.remove("hidden");
      return;
    }

    if (emptyMsg) emptyMsg.classList.add("hidden");

    tbody.innerHTML = demandes.map(d => {
      const nivCol = getNiveauColor(d.niveau);
      const isPending = d.statut === "en_attente";

      return `
        <tr class="border-b border-slate-700 hover:bg-slate-700/30 transition group" data-id="${d.id}">
          <td class="px-4 py-3">
            <div class="font-medium text-slate-100">${escapeHtml(d.apprenantNom)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(d.apprenantEmail)}</div>
            <div class="text-[10px] font-mono text-slate-500 mt-1">${escapeHtml(d.apprenantWallet.slice(0, 8))}...${escapeHtml(d.apprenantWallet.slice(-6))}</div>
          </td>
          <td class="px-4 py-3 text-slate-300">
             <div class="text-sm font-medium">${escapeHtml(d.domaine)}</div>
             ${d.competence ? `<div class="text-[10px] text-slate-500">${escapeHtml(d.competence)}</div>` : ""}
          </td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:${nivCol === 'emerald' ? '#10b98120' : nivCol === 'blue' ? '#3b82f620' : nivCol === 'amber' ? '#f59e0b20' : '#a855f720'}; color:${nivCol === 'emerald' ? '#34d399' : nivCol === 'blue' ? '#60a5fa' : nivCol === 'amber' ? '#fbbf24' : '#c084fc'}">
              ${escapeHtml(d.niveau)}
            </span>
          </td>
          <td class="px-4 py-3 text-[11px] text-slate-400 max-w-xs truncate" title="${escapeHtml(d.message || '')}">
            ${escapeHtml(d.message || "—")}
          </td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${d.statut === "en_attente" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
          d.statut === "acceptée" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            "bg-red-500/10 text-red-400 border-red-500/20"
        }">${escapeHtml(d.statut.replace("_", " "))}</span>
          </td>
          <td class="px-4 py-3 text-right">
            ${isPending ? `
              <div class="flex items-center justify-end gap-2">
                <button onclick="accepterDemande('${d.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-emerald-600/10">✓ Émettre</button>
                <button onclick="refuserDemande('${d.id}')" class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95">✗</button>
              </div>
            ` : `<span class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Traité</span>`}
          </td>
        </tr>
      `;
    }).join("");
  });
}

window.accepterDemande = async function (demandeId) {
  const demande = currentDemandes.find(d => d.id === demandeId);
  if (!demande) return;

  // 1. Vérifier wallet & whitelist avant d'émettre
  const walletStatus = await checkWalletEmissionEligible();
  if (!walletStatus.ok) {
    toast("⚠️ Éligibilité insuffisante : " + walletStatus.reason, "error");
    return;
  }

  // 2. Pré-remplir le formulaire d'émission avec les données de la demande
  const fDomaine = document.getElementById("f-domaine");
  const fComp = document.getElementById("f-competence");
  const fSearch = document.getElementById("search-apprenant");
  const fScore = document.getElementById("a-score");

  if (fDomaine) fDomaine.value = demande.domaine;
  if (fComp) fComp.value = demande.competence || "";
  if (fSearch) fSearch.value = demande.apprenantNom;
  if (fScore) fScore.value = "85"; // Score par défaut

  // Sélectionner le niveau (UI)
  window.selNiveau(demande.niveau);

  // Stocker l'apprenant sélectionné pour l'étape 2
  selectedApprenant = {
    uid: demande.apprenantId,
    nom: demande.apprenantNom,
    email: demande.apprenantEmail,
    wallet: demande.apprenantWallet
  };

  // 3. Passer à l'étape 1 pour que le formateur puisse ajuster
  showSection("sec-creer");
  showStep(1);
  window.mettreAJourApercu();

  toast("Demande acceptée. Vérifiez les détails avant d'émettre.", "success");

  // On ne marque "acceptée" dans Firebase QU'UNE FOIS le badge réellement émis ?
  // Ou on le marque maintenant ? Dans le prompt, on suggère de le marquer maintenant ou après.
  // Je vais le marquer "acceptée" tout de suite pour libérer la vue.
  await mettreAJourStatutDemande(demandeId, "acceptée");
};

window.refuserDemande = async function (demandeId) {
  if (!confirm("Voulez-vous vraiment refuser cette demande ?")) return;
  const res = await mettreAJourStatutDemande(demandeId, "refusée");
  if (res.succes) {
    toast("Demande refusée.", "info");
  } else {
    toast("Erreur lors du refus.", "error");
  }
};

// ── Modale simple ─────────────────────────────────────────
window.fermerModal = function () {
  const ov = document.getElementById("modal-overlay");
  if (ov) ov.classList.add("hidden");
  if (ov) ov.classList.remove("flex");
};

// ── Éligibilité Blockchain (Phase 3) ──────────────────────
/**
 * Vérifie si le formateur peut émettre des badges :
 * 1. Wallet lié dans Firebase
 * 2. MetaMask connecté et correspondant
 * 3. Whitelisté sur le contrat
 */
async function verifierEligibiliteEmission() {
  if (!currentFormateur) return;

  const banner = document.getElementById("banner-eligibilite");
  const msg = document.getElementById("eligibilite-msg");
  const btnE1 = document.getElementById("btn-etape1");
  const btnE2 = document.getElementById("btn-etape2");

  if (!banner || !msg) return;

  let walletLie = currentFormateur.wallet;
  let walletConnecte = null;
  let estWhiteliste = false;

  try {
    const { checkFormateurWhitelisted } = await import("./web3.js");
    const eth = window.ethereum;
    if (eth) {
      const accounts = await eth.request({ method: "eth_accounts" });
      walletConnecte = accounts[0];

      if (walletConnecte && walletLie && walletConnecte.toLowerCase() === walletLie.toLowerCase()) {
        estWhiteliste = await checkFormateurWhitelisted(walletConnecte);
      }
    }
  } catch (e) {
    console.warn("Erreur verifierEligibiliteEmission:", e);
  }

  // Logique d'affichage
  if (!walletLie) {
    banner.classList.remove("hidden");
    msg.textContent = "Action requise : Vous devez lier un wallet blockchain à votre profil.";
    [btnE1, btnE2].forEach(b => { if (b) b.disabled = true; });
  } else if (!walletConnecte) {
    banner.classList.remove("hidden");
    msg.textContent = "Action requise : Connectez MetaMask pour émettre des badges.";
    [btnE1, btnE2].forEach(b => { if (b) b.disabled = true; });
  } else if (walletConnecte.toLowerCase() !== walletLie.toLowerCase()) {
    banner.classList.remove("hidden");
    msg.textContent = `Erreur : Wallet mismatch. Connectez ${walletLie.slice(0, 6)}... dans MetaMask.`;
    [btnE1, btnE2].forEach(b => { if (b) b.disabled = true; });
  } else if (!estWhiteliste) {
    banner.classList.remove("hidden");
    msg.innerHTML = `⚠️ Wallet non whitelisté (${walletConnecte.slice(0, 6)}...). <button onclick="alert('Contactez l\\'admin (admin@skillbadge.com) pour activer votre whitelist.')" class="underline font-bold">Comment s'activer ?</button>`;
    [btnE1, btnE2].forEach(b => { if (b) b.disabled = true; });
  } else {
    banner.classList.add("hidden");
    [btnE1, btnE2].forEach(b => { if (b) b.disabled = false; });
  }
}

// ── Connexion wallet MetaMask pour le formateur ────────────
/**
 * Permet au formateur de lier son vrai wallet MetaMask.
 * 1. Vérifie MetaMask
 * 2. Demande eth_requestAccounts
 * 3. Vérifie/switch réseau Polygon Amoy
 * 4. Sauvegarde l'adresse dans Firebase via lierWallet()
 * 5. Vérifie le statut isFormateur sur le contrat (whitelist)
 * 6. Met à jour l'UI
 */
export async function connecterWalletFormateur() {
  if (!currentFormateur) {
    toast("Vous devez être connecté pour lier un wallet.", "error");
    return;
  }

  const btn = document.getElementById("btn-connect-formateur-wallet");
  const display = document.getElementById("formateur-wallet-display");
  const statusBadge = document.getElementById("wallet-status-badge");

  if (btn) { btn.disabled = true; btn.textContent = "Connexion…"; }

  try {
    const { connectWallet, checkFormateurWhitelisted } = await import("./web3.js");
    const walletAddress = await connectWallet();

    const result = await lierWallet(currentFormateur.uid, walletAddress);
    if (!result.succes) {
      toast(result.erreur || "Impossible de sauvegarder le wallet.", "error");
      return;
    }

    currentFormateur.wallet = walletAddress;
    const adresseTronquee = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
    if (display) {
      display.textContent = adresseTronquee;
      display.title = walletAddress;
    }

    const estWhiteliste = await checkFormateurWhitelisted(walletAddress);

    if (statusBadge) {
      if (estWhiteliste) {
        statusBadge.textContent = "✓ Whitelisté";
        statusBadge.className = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      } else {
        statusBadge.textContent = "⚠ Non whitelisté";
        statusBadge.className = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30";
      }
      statusBadge.classList.remove("hidden");
    }

    if (btn) {
      btn.textContent = "Connecté ✓";
      btn.className = btn.className
        .replace("bg-primary-600", "bg-emerald-600")
        .replace("hover:bg-primary-700", "hover:bg-emerald-700");
    }

    const msg = estWhiteliste
      ? `Wallet connecté : ${adresseTronquee}. Vous êtes whitelisté ✓`
      : `Wallet lié : ${adresseTronquee}. ⚠️ Non whitelisté — contactez l'admin.`;
    toast(msg, estWhiteliste ? "success" : "info");

    await verifierEligibiliteEmission();

  } catch (e) {
    console.error("Erreur connexion wallet formateur:", e);
    toast(e.message || "Erreur de connexion au wallet.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Connecter MetaMask"; }
  }
}

// Expose la fonction globalement pour le bouton HTML
window.connecterWalletFormateur = connecterWalletFormateur;

/**
 * Lit le CONTRACT_ADDRESS et CONTRACT_ABI depuis web3.js
 * via un import dynamique (évite de dupliquer la config).
 */
async function getContractInfo() {
  try {
    // On récupère les infos depuis le module web3.js
    // (l'ABI complet est déjà chargé dans web3.js)
    const mod = await import("./web3.js");
    return {
      CONTRACT_ADDRESS: mod.CONTRACT_ADDRESS || null,
      CONTRACT_ABI: mod.CONTRACT_ABI || null,
    };
  } catch {
    return { CONTRACT_ADDRESS: null, CONTRACT_ABI: null };
  }
}

/**
 * Affiche le wallet actuel du formateur dans l'UI (au chargement).
 */
function afficherWalletFormateur(profil) {
  const display = document.getElementById("formateur-wallet-display");
  const statusBadge = document.getElementById("wallet-status-badge");
  const btn = document.getElementById("btn-connect-formateur-wallet");

  if (!profil?.wallet) return;

  const w = profil.wallet;
  // Un placeholder généré aléatoirement commence par 0x mais ressemble à un wallet réel.
  // On affiche l'adresse tronquée dans tous les cas.
  const adresseTronquee = `${w.slice(0, 6)}…${w.slice(-4)}`;

  if (display) {
    display.textContent = adresseTronquee;
    display.title = w;
  }

  // Le badge statut reste caché jusqu'à vérification on-chain
  if (statusBadge) statusBadge.classList.add("hidden");
}

// ── Init navigation UI (drawer, sidebar) ───────────────────
function wireNavigationUi() {
  const open = document.getElementById("btn-open-drawer");
  const back = document.getElementById("mobile-drawer-backdrop");
  const drawer = document.getElementById("mobile-drawer");

  const closeDrawer = () => {
    drawer?.classList.add("-translate-x-full");
    if (drawer) drawer.hidden = true;
    back?.classList.add("hidden");
    open?.setAttribute("aria-expanded", "false");
  };

  const openDrawer = () => {
    if (drawer) {
      drawer.hidden = false;
      drawer.classList.remove("-translate-x-full");
    }
    back?.classList.remove("hidden");
    open?.setAttribute("aria-expanded", "true");
  };

  open?.addEventListener("click", () => {
    if (drawer?.hidden) openDrawer();
    else closeDrawer();
  });
  back?.addEventListener("click", closeDrawer);

  document.querySelectorAll(".nav-item-desktop, .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sec = btn.getAttribute("data-section");
      if (sec) {
        showSection(sec);
        if (btn.classList.contains("nav-item")) closeDrawer();
      }
    });
  });

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try {
      await deconnecter();
    } catch (e) {
      console.error(e);
    }
    window.location.href = "login.html";
  });

  const search = document.getElementById("search-apprenant");
  let t;
  search?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => window.rechercherApprenant(), 300);
  });
}

// ── Point d’entrée ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setAuthLoading(true);
  showAppShell(false);
  setupStepNavigation();
  wireNavigationUi();

  observerConnexion(async (user, profil) => {
    if (typeof unsubDemandes === "function") {
      try {
        unsubDemandes();
      } catch (_) { }
      unsubDemandes = null;
    }

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!profil) {
      window.location.href = "login.html";
      return;
    }

    if (profil.role !== "formateur") {
      redirigerSelonRole(profil);
      return;
    }

    // ── Vérification statut approbation (Phase 3) ───────────
    if (profil.statut === "en_attente") {
      window.location.href = "pending.html";
      return;
    }
    if (profil.statut === "refuse") {
      window.location.href = "pending.html";
      return;
    }

    currentFormateur = { ...profil, uid: user.uid };

    const nomEl = document.getElementById("formateur-nom");
    const orgEl = document.getElementById("formateur-org");
    const av = document.getElementById("avatar-top");
    if (nomEl) nomEl.textContent = profil.nom || "Formateur";
    if (orgEl) orgEl.textContent = profil.organisation || "—";
    if (av) av.textContent = initiales(profil.nom);

    // Afficher le wallet du formateur dans la carte statut
    afficherWalletFormateur(profil);

    // Câbler le bouton de connexion wallet formateur
    const btnWallet = document.getElementById("btn-connect-formateur-wallet");
    if (btnWallet) {
      btnWallet.addEventListener("click", connecterWalletFormateur);
    }

    // ── Bannière de statut ──────────────────────────────────
    // Pour les anciens comptes sans statut (pré-Phase 3), afficher un avertissement
    // doux mais permettre l'émission (rétrocompatibilité).
    // Les nouveaux comptes DOIVENT avoir statut === "approuve".
    const bannerEl = document.getElementById("banner-approbation");
    if (bannerEl) {
      if (!profil.statut) {
        // Compte legacy : avertissement non bloquant
        bannerEl.innerHTML = `
          <div class="flex items-start gap-3">
            <svg class="h-5 w-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <div>
              <p class="text-sm font-semibold text-amber-300">Compte legacy (pré-Phase 3)</p>
              <p class="text-xs text-amber-200/70 mt-0.5">Votre compte a été créé avant le système d'approbation. Demandez à l'admin de valider votre statut dans Firebase pour activer toutes les fonctionnalités.</p>
            </div>
          </div>`;
        bannerEl.className = "mx-4 lg:mx-8 mt-4 rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-amber-200";
        bannerEl.classList.remove("hidden");
      } else if (profil.statut === "approuve") {
        // Compte approuvé → bannière verte discrète
        bannerEl.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-400 text-xs">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            Compte formateur approuvé · Vous pouvez émettre des badges certifiés.
          </div>`;
        bannerEl.className = "mx-4 lg:mx-8 mt-4 rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-3";
        bannerEl.classList.remove("hidden");
        // Masquer automatiquement après 5 secondes
        setTimeout(() => bannerEl.classList.add("hidden"), 5000);
      }
    }

    setAuthLoading(false);
    showAppShell(true);

    showSection("sec-creer");
    showStep(1);
    window.mettreAJourApercu();

    await window.chargerHistorique();
    chargerDemandes();

    // 5. Observer les changements de comptes MetaMask
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", async () => {
        console.log("🦊 Compte MetaMask changé, re-vérification...");
        await verifierEligibiliteEmission();
      });
    }

    // 6. Vérifier l'éligibilité initiale
    await verifierEligibiliteEmission();
  });
});
