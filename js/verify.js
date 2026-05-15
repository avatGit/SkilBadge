// ============================================================
//  verify.js — Portail Recruteur SkillBadge
//  Recherche, vérification on-chain, portfolios détaillés
// ============================================================

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { get, ref } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getBadgesApprenant, couleurNiveau, couleurDomaine, formaterDate } from "./badges.js";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./web3.js";

// Configuration Réseau Amoy (Public RPC pour lecture seule)
const AMOY_RPC = "https://rpc-amoy.polygon.technology";

// État local
let currentRecruteur = null;
let allApprenants = [];
let filteredApprenants = [];

// ─────────────────────────────────────────────────────────
//  AUTH GUARD & INITIALISATION
// ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await get(ref(db, `utilisateurs/${user.uid}`));
    const profil = snap.val();

    if (!profil || profil.role !== "recruteur") {
      alert("Accès réservé aux recruteurs autorisés.");
      window.location.href = "login.html";
      return;
    }

    currentRecruteur = { ...profil, uid: user.uid };

    // UI Header
    document.getElementById("recruteur-info").classList.remove("hidden");
    document.getElementById("rec-name").textContent = profil.nom || "Recruteur";
    document.getElementById("rec-avatar").textContent = (profil.nom || "R")[0].toUpperCase();

    // Charger les données
    await chargerApprenants();

    // Gérer les paramètres URL (ex: ?wallet=0x...)
    const urlParams = new URLSearchParams(window.location.search);
    const walletQuery = urlParams.get('wallet');
    if (walletQuery) {
      const candidate = allApprenants.find(a => a.wallet?.toLowerCase() === walletQuery.toLowerCase());
      if (candidate) ouvrirPortfolio(candidate.uid);
    }

  } catch (e) {
    console.error("Erreur initialisation recruteur:", e);
  }
});

// ─────────────────────────────────────────────────────────
//  RECHERCHE & CHARGEMENT
// ─────────────────────────────────────────────────────────
async function chargerApprenants() {
  const loading = document.getElementById("table-loading");
  const tbody = document.getElementById("apprenants-table");

  try {
    const snapshot = await get(ref(db, "utilisateurs"));
    if (!snapshot.exists()) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500">Aucun utilisateur trouvé.</td></tr>';
      return;
    }

    const raw = snapshot.val();
    allApprenants = Object.entries(raw)
      .filter(([, u]) => u.role === "apprenant")
      .map(([uid, u]) => ({ uid, ...u }))
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

    document.getElementById("total-candidates").textContent = allApprenants.length;

    renderTable(allApprenants);
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-red-400">Erreur lors du chargement des candidats.</td></tr>';
  } finally {
    if (loading) loading.remove();
  }
}

function renderTable(list) {
  const tbody = document.getElementById("apprenants-table");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500">Aucun candidat ne correspond à votre recherche.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    const w = a.wallet || "—";
    const wShort = w.length > 15 ? `${w.slice(0, 8)}...${w.slice(-6)}` : w;
    return `
      <tr class="hover:bg-slate-800/30 transition-colors group">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold border border-slate-700">${(a.nom || "A")[0]}</div>
            <span class="font-semibold text-slate-200">${a.nom || "Inconnu"}</span>
          </div>
        </td>
        <td class="px-6 py-4 hidden md:table-cell text-sm text-slate-400">${a.email || "—"}</td>
        <td class="px-6 py-4 hidden lg:table-cell">
           <code class="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/10 font-mono">${wShort}</code>
        </td>
        <td class="px-6 py-4 text-center">
           <span class="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">—</span>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="ouvrirPortfolio('${a.uid}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95">VOIR</button>
        </td>
      </tr>
    `;
  }).join("");
}

// Recherche temps réel
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();

  if (q.length < 1) {
    searchResults.classList.add("hidden");
    renderTable(allApprenants);
    return;
  }

  filteredApprenants = allApprenants.filter(a =>
    (a.nom || "").toLowerCase().includes(q) ||
    (a.email || "").toLowerCase().includes(q) ||
    (a.wallet || "").toLowerCase().includes(q)
  );

  // Update table
  renderTable(filteredApprenants);

  // Show Dropdown
  if (filteredApprenants.length > 0) {
    searchResults.innerHTML = filteredApprenants.slice(0, 5).map(a => `
      <div class="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0 flex items-center justify-between" onclick="ouvrirPortfolio('${a.uid}')">
        <div>
          <p class="text-sm font-bold text-white">${a.nom}</p>
          <p class="text-[10px] text-slate-500">${a.email}</p>
        </div>
        <span class="text-[10px] font-mono text-blue-500">${a.wallet?.slice(0, 6)}...</span>
      </div>
    `).join("");
    searchResults.classList.remove("hidden");
  } else {
    searchResults.innerHTML = '<div class="p-4 text-center text-slate-500 text-xs">Aucun résultat trouvé</div>';
    searchResults.classList.remove("hidden");
  }
});

// Fermer le dropdown au clic ailleurs
document.addEventListener("click", (e) => {
  if (!searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.classList.add("hidden");
  }
});

// ─────────────────────────────────────────────────────────
//  MODAL & PORTFOLIO
// ─────────────────────────────────────────────────────────
window.ouvrirPortfolio = async function (uid) {
  const modal = document.getElementById("portfolio-modal");
  const grid = document.getElementById("modal-badges-grid");
  const searchResults = document.getElementById("search-results");

  if (searchResults) searchResults.classList.add("hidden");

  // 1. Charger les infos de l'apprenant
  const apprenant = allApprenants.find(a => a.uid === uid);
  if (!apprenant) return;

  // UI Reset & Loading
  document.getElementById("modal-apprenant-nom").textContent = apprenant.nom || "Chargement...";
  document.getElementById("modal-apprenant-email").textContent = apprenant.email || "—";
  document.getElementById("modal-avatar").textContent = (apprenant.nom || "?")[0].toUpperCase();
  document.getElementById("modal-wallet-full").textContent = apprenant.wallet || "Aucun wallet lié";
  document.getElementById("modal-wallet-short").textContent = apprenant.wallet ? `${apprenant.wallet.slice(0, 6)}...${apprenant.wallet.slice(-4)}` : "—";
  grid.innerHTML = '<div class="col-span-full py-20 text-center"><div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p class="mt-4 text-slate-400 text-sm">Vérification des certifications on-chain...</p></div>';

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  try {
    // 2. Charger les badges depuis Firebase
    const badges = await getBadgesApprenant(uid);
    document.getElementById("modal-count-badges").textContent = badges.length;

    if (badges.length === 0) {
      grid.innerHTML = '<div class="col-span-full py-20 text-center text-slate-500">Aucun badge trouvé pour ce candidat.</div>';
      document.getElementById("modal-count-verified").textContent = "0";
      return;
    }

    // 3. Vérification Blockchain (Polygon Amoy)
    let verifiedCount = 0;
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const domaineToId = {
      "Développement Web": 0,
      "Développement Mobile": 1,
      "Data & IA": 2,
      "Cybersécurité": 3,
      "UI/UX Design": 4,
      "DevOps": 5,
      "Blockchain": 6,
      "Marketing Digital": 7
    };

    const badgeHtmls = await Promise.all(badges.map(async (badge) => {
      let isVerified = false;
      let checkStatus = "🟡 Vérification...";

      if (apprenant.wallet && /^0x[a-fA-F0-9]{40}$/.test(apprenant.wallet)) {
        try {
          const tokenId = domaineToId[badge.domaine] ?? 0;
          const balance = await contract.balanceOf(apprenant.wallet, tokenId);
          if (balance > 0n) {
            isVerified = true;
            verifiedCount++;
            checkStatus = '<span class="text-emerald-400">✅ Vérifié on-chain</span>';
          } else {
            checkStatus = '<span class="text-red-400">⚠️ Non trouvé on-chain</span>';
          }
        } catch (err) {
          console.error("Blockchain check failed:", err);
          checkStatus = '<span class="text-slate-500">❓ Erreur réseau</span>';
        }
      } else {
        checkStatus = '<span class="text-amber-400">⚠️ Wallet absent/invalide</span>';
      }

      const nivCol = (badge.niveau === "Débutant" ? "emerald" : badge.niveau === "Intermédiaire" ? "blue" : badge.niveau === "Avancé" ? "amber" : "purple");
      const scanUrl = badge.txHash ? `https://amoy.polygonscan.com/tx/${badge.txHash}` : "#";
      const dateStr = formaterDate(badge.dateEmission);

      return `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-blue-500/50 transition relative group flex flex-col h-full">
          <!-- En-tête Badge -->
          <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center text-xl text-blue-400">
              🏆
            </div>
            <div class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-slate-900 rounded border border-slate-700">
               ${checkStatus}
            </div>
          </div>

          <!-- Infos -->
          <h3 class="font-bold text-white text-lg leading-tight mb-1 truncate">${badge.nom}</h3>
          <p class="text-slate-400 text-xs mb-4">${badge.domaine}</p>

          <!-- Détails Grid -->
          <div class="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 mt-auto">
            <div>
              <span class="text-slate-500 block text-[10px]">Niveau</span>
              <span class="font-medium text-blue-300">${badge.niveau}</span>
            </div>
            <div>
              <span class="text-slate-500 block text-[10px]">Émis par</span>
              <span class="font-medium truncate block">${badge.formateurNom}</span>
            </div>
          </div>

          <!-- Footer / Lien Blockchain -->
          <div class="pt-3 border-t border-slate-700 flex justify-between items-center">
            <span class="text-[10px] text-slate-500">${dateStr}</span>
            ${badge.txHash ? `
              <a href="${scanUrl}" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Explorer ↗
              </a>
            ` : `
              <span class="text-[10px] text-slate-600 italic">Off-chain</span>
            `}
          </div>
        </div>
      `;
    }));

    grid.innerHTML = badgeHtmls.join("");
    document.getElementById("modal-count-verified").textContent = verifiedCount;

  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="col-span-full py-20 text-center text-red-500">Erreur lors du chargement du portfolio.</div>';
  }
};

window.fermerModal = function () {
  document.getElementById("portfolio-modal").classList.add("hidden");
  document.getElementById("portfolio-modal").classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
};

// Listeners UI Modal
document.getElementById("btn-close-modal")?.addEventListener("click", window.fermerModal);
document.getElementById("portfolio-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "portfolio-modal") window.fermerModal();
});

document.getElementById("btn-copy-wallet")?.addEventListener("click", () => {
  const wallet = document.getElementById("modal-wallet-full").textContent;
  if (!wallet || wallet === "Aucun wallet lié") return;
  navigator.clipboard.writeText(wallet).then(() => {
    const btn = document.getElementById("btn-copy-wallet");
    btn.textContent = "COPIÉ !";
    btn.classList.add("text-emerald-500");
    setTimeout(() => {
      btn.textContent = "COPIER";
      btn.classList.remove("text-emerald-500");
    }, 2000);
  });
});

document.getElementById("btn-print")?.addEventListener("click", () => {
  window.print();
});

// Logout
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (e) {
    console.error(e);
  }
});
