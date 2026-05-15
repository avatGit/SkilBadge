// ============================================================
//  demandes.js — Gestion des demandes de validation
//  Envoi par l'apprenant, traitement par le formateur
// ============================================================

import {
  ref, set, get, push, update, onValue, remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { db } from "./firebase.js";

// ─────────────────────────────────────────────────────────
//  ENVOYER UNE DEMANDE DE VALIDATION (apprenant → formateur)
//  Champs optionnels : competence (libellé compétence visée),
//  preuveNom, preuveTaille, preuveType — métadonnées fichier uniquement (pas de binaire en RTDB).
// ─────────────────────────────────────────────────────────
export async function envoyerDemande({
  apprenantId, apprenantNom, apprenantEmail, apprenantWallet,
  formateurId, domaine, niveau, message,
  competence = "",
  preuveNom = "",
  preuveTaille = null,
  preuveType = ""
}) {
  try {
    const nouveauRef = push(ref(db, "demandes_validation"));
    const payload = {
      apprenantId, apprenantNom, apprenantEmail, apprenantWallet,
      formateurId, domaine, niveau, message,
      statut   : "en_attente",
      createdAt: Date.now()
    };
    if (competence) payload.competence = competence;
    if (preuveNom) payload.preuveNom = preuveNom;
    if (preuveTaille != null) payload.preuveTaille = preuveTaille;
    if (preuveType) payload.preuveType = preuveType;

    await set(nouveauRef, payload);
    return { succes: true, id: nouveauRef.key };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LES DEMANDES REÇUES PAR UN FORMATEUR
// ─────────────────────────────────────────────────────────
export async function getDemandesFormateur(formateurId) {
  const snapshot = await get(ref(db, "demandes_validation"));
  if (!snapshot.exists()) return [];

  const toutes = snapshot.val();
  return Object.entries(toutes)
    .filter(([, v]) => v.formateurId === formateurId)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ─────────────────────────────────────────────────────────
//  ÉCOUTER EN TEMPS RÉEL les demandes d'un formateur
// ─────────────────────────────────────────────────────────
export function ecouterDemandesFormateur(formateurId, callback) {
  return onValue(ref(db, "demandes_validation"), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const toutes = snapshot.val();
    const demandes = Object.entries(toutes)
      .filter(([, v]) => v.formateurId === formateurId)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(demandes);
  });
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LES DEMANDES ENVOYÉES PAR UN APPRENANT
// ─────────────────────────────────────────────────────────
export async function getDemandesApprenant(apprenantId) {
  const snapshot = await get(ref(db, "demandes_validation"));
  if (!snapshot.exists()) return [];

  const toutes = snapshot.val();
  return Object.entries(toutes)
    .filter(([, v]) => v.apprenantId === apprenantId)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ─────────────────────────────────────────────────────────
//  ÉCOUTER EN TEMPS RÉEL les demandes envoyées par un apprenant
// ─────────────────────────────────────────────────────────
export function ecouterDemandesApprenant(apprenantId, callback) {
  return onValue(ref(db, "demandes_validation"), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const toutes = snapshot.val();
    const demandes = Object.entries(toutes)
      .filter(([, v]) => v.apprenantId === apprenantId)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(demandes);
  });
}

// ─────────────────────────────────────────────────────────
//  SUPPRIMER UNE DEMANDE (formateur après traitement)
// ─────────────────────────────────────────────────────────
export async function supprimerDemande(demandeId) {
  try {
    await remove(ref(db, `demandes_validation/${demandeId}`));
    return { succes: true };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  METTRE À JOUR LE STATUT D'UNE DEMANDE
// ─────────────────────────────────────────────────────────
export async function mettreAJourStatutDemande(demandeId, statut) {
  try {
    await update(ref(db, `demandes_validation/${demandeId}`), { statut });
    return { succes: true };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}