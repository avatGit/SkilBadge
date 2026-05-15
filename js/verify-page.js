// ============================================================
//  Page publique de vérification des badges par adresse wallet
// ============================================================

import { verifierBadgesParWallet, formaterDate, couleurNiveau } from "./badges.js";

const POLYGONSCAN_TX = "https://amoy.polygonscan.com/tx/";

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function render() {
  const root = document.getElementById("verify-root");
  const params = new URLSearchParams(window.location.search);
  const address = (params.get("address") || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    root.innerHTML = `
      <div class="max-w-lg mx-auto bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
        <h1 class="text-xl font-semibold text-white mb-2">Vérification SkillBadge</h1>
        <p class="text-slate-400 text-sm mb-4">Indiquez une adresse Ethereum valide dans l’URL, par exemple&nbsp;:</p>
        <code class="block text-xs bg-slate-900 text-slate-300 p-3 rounded-lg break-all">verify.html?address=0x…</code>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="max-w-3xl mx-auto">
      <div class="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700 mb-6">
        <h1 class="text-xl font-semibold text-white mb-1">Portfolio vérifié</h1>
        <p class="text-slate-400 text-sm">Adresse&nbsp;: <span class="text-slate-200 font-mono">${escapeHtml(address)}</span></p>
      </div>
      <div id="verify-loading" class="flex justify-center py-12">
        <div class="spinner-verify" aria-label="Chargement"></div>
      </div>
      <div id="verify-list" class="hidden space-y-4"></div>
    </div>`;

  verifierBadgesParWallet(address)
    .then((badges) => {
      const loading = document.getElementById("verify-loading");
      const list = document.getElementById("verify-list");
      if (loading) loading.classList.add("hidden");
      if (!list) return;

      const actifs = badges.filter((b) => b.statut !== "révoqué");
      if (actifs.length === 0) {
        list.classList.remove("hidden");
        list.innerHTML = `
          <p class="text-slate-400 text-center py-8">Aucun badge actif trouvé pour cette adresse.</p>`;
        return;
      }

      list.classList.remove("hidden");
      list.innerHTML = actifs
        .map((b) => {
          const pill = couleurNiveau(b.niveau);
          const tx = b.txHash ? `${POLYGONSCAN_TX}${escapeHtml(b.txHash)}` : "#";
          const onChain = b.blockchainUsed
            ? '<span class="text-emerald-400 text-xs font-medium">Vérifié on-chain</span>'
            : '<span class="text-slate-500 text-xs">Hors chaîne (démo)</span>';
          return `
          <article class="bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-700 flex flex-col sm:flex-row gap-4">
            <div class="hex-badge-verify shrink-0" style="--hex-bg:${escapeHtml(couleurDomaineSafe(b.domaine))}" aria-hidden="true"></div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-white">${escapeHtml(b.nom)}</h2>
              <p class="text-slate-400 text-sm">${escapeHtml(b.domaine || "")}</p>
              <span class="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full" style="background:${pill.bg};color:${pill.color}">${escapeHtml(b.niveau || "")}</span>
              <p class="text-slate-500 text-xs mt-2">Émis le ${escapeHtml(formaterDate(b.dateEmission))} — ${escapeHtml(b.formateurNom || "")} (${escapeHtml(b.organisation || "")})</p>
              <p class="text-slate-500 text-xs mt-1">Score&nbsp;: ${escapeHtml(String(b.score ?? "—"))}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <a href="${tx}" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline text-sm">Polygonscan</a>
                ${onChain}
              </div>
            </div>
          </article>`;
        })
        .join("");
    })
    .catch((e) => {
      const loading = document.getElementById("verify-loading");
      if (loading) loading.classList.add("hidden");
      const list = document.getElementById("verify-list");
      if (list) {
        list.classList.remove("hidden");
        list.innerHTML = `<p class="text-red-400 text-center">${escapeHtml(e.message || "Erreur de chargement")}</p>`;
      }
    });
}

function couleurDomaineSafe(domaine) {
  const map = {
    "Développement Web": "#c8e0fb",
    "Data Science": "#fce8c8",
    "Design UI/UX": "#d8ccf8",
    "Cybersécurité": "#f8d0d8",
    Mobile: "#c8f0e0",
    Blockchain: "#d0eef8",
  };
  return map[domaine] || "#334155";
}

document.addEventListener("DOMContentLoaded", render);
