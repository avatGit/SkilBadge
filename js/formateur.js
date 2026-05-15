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
    "Débutant":      "web-debutant.png",
    "Intermédiaire": "web-intermediaire.png",
    "Avancé":        "web-avance.png",
    "Expert":        "web-expert.png",
  },
  "Développement Mobile": {
    "Débutant":      "mobile-debutant.png",
    "Intermédiaire": "mobile-intermediaire.png",
    "Avancé":        "mobile-avance.png",
    "Expert":        "mobile-expert.png",
  },
  "Data & IA": {
    "Débutant":      "data-debutant.png",
    "Intermédiaire": "data-intermediaire.png",
    "Avancé":        "data-avance.png",
    "Expert":        "data-expert.png",
  },
  "Cybersécurité": {
    "Débutant":      "cyber-debutant.png",
    "Intermédiaire": "cyber-intermediaire.png",
    "Avancé":        "cyber-avance.png",
    "Expert":        "cyber-expert.png",
  },
  "UI/UX Design": {
    "Débutant":      "design-debutant.png",
    "Intermédiaire": "design-intermediaire.png",
    "Avancé":        "design-avance.png",
    "Expert":        "design-expert.png",
  },
  "DevOps": {
    "Débutant":      "devops-debutant.png",
    "Intermédiaire": "devops-intermediaire.png",
    "Avancé":        "devops-avance.png",
    "Expert":        "devops-expert.png",
  },
  "Blockchain": {
    "Débutant":      "web-debutant.png",
    "Intermédiaire": "web-intermediaire.png",
    "Avancé":        "web-avance.png",
    "Expert":        "web-expert.png",
  },
  "Marketing Digital": {
    "Débutant":      "design-debutant.png",
    "Intermédiaire": "design-intermediaire.png",
    "Avancé":        "design-avance.png",
    "Expert":        "design-expert.png",
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

// ── Demandes temps réel ─────────────────────────────────────
function majCompteurDemandes(demandes) {
  const n = demandes.filter((d) => d.statut === "en_attente").length;
  const desk = document.getElementById("dem-count");
  const mob = document.getElementById("dem-count-mobile");
  [desk, mob].forEach((el) => {
    if (!el) return;
    if (n > 0) {
      el.textContent = String(n);
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  });
}

function ecouterDemandes() {
  if (!currentFormateur) return;
  if (typeof unsubDemandes === "function") {
    try {
      unsubDemandes();
    } catch (_) {}
    unsubDemandes = null;
  }

  unsubDemandes = ecouterDemandesFormateur(currentFormateur.uid, (demandes) => {
    majCompteurDemandes(demandes);
    const tbody = document.getElementById("dem-tbody");
    if (!tbody) return;

    if (!demandes.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Aucune demande reçue.</td></tr>';
      return;
    }

    tbody.innerHTML = demandes
      .map((d) => {
        const st = d.statut || "";
        const pill =
          st === "en_attente"
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            : st === "acceptée"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-red-500/20 text-red-300 border border-red-500/40";
        const actions =
          st === "en_attente"
            ? `<div class="flex flex-wrap gap-2">
                 <button type="button" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition hover:scale-[1.02]" data-demande="${escapeHtml(d.id)}" data-action="acceptée">Accepter</button>
                 <button type="button" class="rounded-lg border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition hover:scale-[1.02]" data-demande="${escapeHtml(d.id)}" data-action="refusée">Refuser</button>
               </div>`
            : '<span class="text-slate-500">—</span>';
        return `<tr class="border-b border-slate-700/80">
          <td class="px-4 py-3">
            <div class="font-medium text-slate-100">${escapeHtml(d.apprenantNom || "")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(d.apprenantEmail || "")}</div>
            <div class="font-mono text-[10px] text-slate-600">${escapeHtml((d.apprenantWallet || "").slice(0, 10))}…</div>
          </td>
          <td class="px-4 py-3 text-slate-300">${escapeHtml(d.domaine || "")}</td>
          <td class="px-4 py-3 text-slate-300">${escapeHtml(d.niveau || "")}</td>
          <td class="px-4 py-3"><span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pill}">${escapeHtml(st.replace("_", " "))}</span></td>
          <td class="px-4 py-3">${actions}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("button[data-demande]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-demande");
        const action = btn.getAttribute("data-action");
        await traiterDemande(id, action);
      });
    });
  });
}

async function traiterDemande(demandeId, statut) {
  try {
    const res = await mettreAJourStatutDemande(demandeId, statut);
    if (!res.succes) {
      toast(res.erreur || "Mise à jour impossible.", "error");
      return;
    }
    toast(statut === "acceptée" ? "Demande acceptée." : "Demande refusée.", "success");
  } catch (e) {
    toast(e.message || "Erreur.", "error");
  }
}

// ── Modale simple ─────────────────────────────────────────
window.fermerModal = function () {
  const ov = document.getElementById("modal-overlay");
  if (ov) ov.classList.add("hidden");
  if (ov) ov.classList.remove("flex");
};

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
    // 1) Connecte MetaMask + switch Polygon Amoy (via web3.js)
    const walletAddress = await connectWallet();

    // 2) Sauvegarder dans Firebase
    const result = await lierWallet(currentFormateur.uid, walletAddress);
    if (!result.succes) {
      toast(result.erreur || "Impossible de sauvegarder le wallet.", "error");
      return;
    }

    // 3) Mettre à jour l'état local
    currentFormateur.wallet = walletAddress;

    // 4) Affichage adresse tronquée
    const adresseTronquee = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
    if (display) {
      display.textContent = adresseTronquee;
      display.title = walletAddress;
    }

    // 5) Vérifier si le formateur est whitelisté sur le contrat
    let estWhitelisté = false;
    try {
      if (window.ethers && typeof window.ethers !== "undefined") {
        const eth = window.ethereum;
        if (eth) {
          const { CONTRACT_ADDRESS, CONTRACT_ABI } = await getContractInfo();
          if (CONTRACT_ADDRESS && CONTRACT_ABI) {
            const provider = new window.ethers.BrowserProvider(eth);
            const contract = new window.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            estWhitelisté = await contract.isFormateur(walletAddress);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Impossible de vérifier le statut formateur on-chain:", e);
    }

    // 6) Mettre à jour l'UI selon statut whitelist
    if (statusBadge) {
      if (estWhitelisté) {
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

    const msg = estWhitelisté
      ? `Wallet connecté : ${adresseTronquee}. Vous êtes whitelisté ✓`
      : `Wallet lié : ${adresseTronquee}. ⚠️ Non whitelisté — contactez l'admin.`;
    toast(msg, estWhitelisté ? "success" : "info");

  } catch (e) {
    console.error("Erreur connexion wallet formateur:", e);
    const msg = e.message?.includes("MetaMask")
      ? "MetaMask non détecté. Installez l'extension et réessayez."
      : (e.message || "Erreur de connexion au wallet.");
    toast(msg, "error");
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
      } catch (_) {}
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
    const av    = document.getElementById("avatar-top");
    if (nomEl) nomEl.textContent = profil.nom || "Formateur";
    if (orgEl) orgEl.textContent = profil.organisation || "—";
    if (av)    av.textContent = initiales(profil.nom);

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
    ecouterDemandes();
  });
});
