// ============================================================
//  badges.js — Opérations sur les badges et types de badges
//  Créer, attribuer, lire, écouter en temps réel
// ============================================================

import {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { db } from "./firebase.js";
import { genererHashNFT, genererBlocNumber, getProfil } from "./auth.js";
import { connectWallet, mintBadgeOnChain } from "./web3.js";
import { uploadMetadataToIPFS, uploadImageToIPFS, getIPFSUri } from "./ipfs.js";
// ─────────────────────────────────────────────────────────
//  ÉTAPE 1 — CRÉER UN TYPE DE BADGE
//  Appelé par le formateur dans le formulaire A1
// ─────────────────────────────────────────────────────────
export async function creerTypeBadge({
  nom,
  domaine,
  niveau,
  criteres,
  validite,
  scoreMin,
  formateurId,
  formateurNom,
  organisation,
}) {
  try {
    const nouveauRef = push(ref(db, "types_badges"));
    await set(nouveauRef, {
      nom,
      domaine,
      niveau,
      criteres,
      validite,
      scoreMin,
      formateurId,
      formateurNom,
      organisation,
      createdAt: Date.now(),
    });
    return { succes: true, id: nouveauRef.key };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LES TYPES DE BADGES D'UN FORMATEUR
// ─────────────────────────────────────────────────────────
export async function getTypesBadgesFormateur(formateurId) {
  const snapshot = await get(ref(db, "types_badges"));
  if (!snapshot.exists()) return [];

  const tous = snapshot.val();
  return Object.entries(tous)
    .filter(([, v]) => v.formateurId === formateurId)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ─────────────────────────────────────────────────────────
//  ÉTAPE 2 — ATTRIBUER UN BADGE À UN APPRENANT (VERSION HYBRIDE)
//  Appelé par le formateur dans la modale A2
// ─────────────────────────────────────────────────────────
export async function attribuerBadge({
  typeId,
  nom,
  domaine,
  niveau,
  apprenantId,
  apprenantNom,
  apprenantWallet,
  apprenantEmail,
  formateurId,
  formateurNom,
  organisation,
  score,
  commentaire,
  validite,
}) {
  try {
    // ── VÉRIFICATIONS PHASE 3 ──────────────────────────────────────
    // 1. Récupérer le profil du formateur
    const formateurProfil = await getProfil(formateurId);
    if (!formateurProfil || !formateurProfil.wallet) {
      return { succes: false, erreur: "Profil formateur incomplet. Contactez l'admin." };
    }

    // 2. Vérifier que le formateur est approuvé par l'admin
    if (formateurProfil.statut === "en_attente") {
      return {
        succes: false,
        erreur: "⏳ Votre compte formateur n'est pas encore approuvé par l'administrateur. Vous recevrez un email dès la décision prise.",
        blocage: "statut_en_attente",
      };
    }
    if (formateurProfil.statut === "refuse") {
      return {
        succes: false,
        erreur: "❌ Votre compte formateur a été refusé. Contactez l'admin pour plus d'informations.",
        blocage: "statut_refuse",
      };
    }
    // Si pas de statut (anciens comptes) ou statut != "approuve" → bloquer
    if (formateurProfil.role === "formateur" && formateurProfil.statut && formateurProfil.statut !== "approuve") {
      return {
        succes: false,
        erreur: "Votre compte formateur n'est pas autorisé à émettre des badges.",
        blocage: "statut_invalide",
      };
    }

    const formateurWallet = formateurProfil.wallet;

    // 2. Calculer la date d'expiration
    const maintenant = Date.now();
    const durees = {
      "6mois": 6 * 30 * 24 * 60 * 60 * 1000,
      "1an": 365 * 24 * 60 * 60 * 1000,
      "2ans": 2 * 365 * 24 * 60 * 60 * 1000,
      illimite: null,
    };
    const dateExpiration = durees[validite]
      ? maintenant + durees[validite]
      : null;

    // 3. Mapper le domaine vers un ID blockchain (0-5)
    const domaineIds = {
      "Développement Web": 0,
      "Développement Mobile": 1,
      "Data & IA": 2,
      Cybersécurité: 3,
      "UI/UX Design": 4,
      DevOps: 5,
    };
    const badgeId = domaineIds[domaine] || 0;

    const badgeImages = {
      "Développement Web": {
        Débutant:       "web-debutant.png",
        Intermédiaire:  "web-intermediaire.png",
        Avancé:         "web-avance.png",
        Expert:         "web-expert.png",
      },
      "Développement Mobile": {
        Débutant:       "mobile-debutant.png",
        Intermédiaire:  "mobile-intermediaire.png",
        Avancé:         "mobile-avance.png",
        Expert:         "mobile-expert.png",
      },
      "Data & IA": {
        Débutant:       "data-debutant.png",
        Intermédiaire:  "data-intermediaire.png",
        Avancé:         "data-avance.png",
        Expert:         "data-expert.png",
      },
      "Cybersécurité": {
        Débutant:       "cyber-debutant.png",
        Intermédiaire:  "cyber-intermediaire.png",
        Avancé:         "cyber-avance.png",
        Expert:         "cyber-expert.png",
      },
      "UI/UX Design": {
        Débutant:       "design-debutant.png",
        Intermédiaire:  "design-intermediaire.png",
        Avancé:         "design-avance.png",
        Expert:         "design-expert.png",
      },
      "DevOps": {
        Débutant:       "devops-debutant.png",
        Intermédiaire:  "devops-intermediaire.png",
        Avancé:         "devops-avance.png",
        Expert:         "devops-expert.png",
      },
      // Domaines sans images dédiées → réutilise web / design
      "Blockchain": {
        Débutant:       "web-debutant.png",
        Intermédiaire:  "web-intermediaire.png",
        Avancé:         "web-avance.png",
        Expert:         "web-expert.png",
      },
      "Marketing Digital": {
        Débutant:       "design-debutant.png",
        Intermédiaire:  "design-intermediaire.png",
        Avancé:         "design-avance.png",
        Expert:         "design-expert.png",
      },
    };

    const imageName = badgeImages[domaine]?.[niveau];
    // Fallback : chemin local si servi, sinon Vercel
    let imageUri = imageName
      ? `public/images/badges/${imageName}`
      : `https://skillbadge.vercel.app/badges/web-debutant.png`;

    // 4. Préparer les métadonnées pour IPFS
    const metadata = {
      name: `${nom} — ${niveau}`,
      description: `Badge de compétence en ${domaine} — Niveau ${niveau}`,
      image: imageUri,
      attributes: [
        { trait_type: "Niveau", value: niveau },
        { trait_type: "Domaine", value: domaine },
        { trait_type: "Score", value: score },
        { trait_type: "Émetteur", value: formateurNom },
        { trait_type: "Organisation", value: organisation },
        { trait_type: "Date", value: new Date(maintenant).toISOString() },
      ],
    };

    // 5. Upload sur IPFS (avec fallback si échec)
    let ipfsCID = "";
    let ipfsURI = "";
    
    try {
      // a) Upload de l'image sur IPFS
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const imageCid = await uploadImageToIPFS(
        new File([blob], imageName, { type: "image/png" })
      );
      const imageUriIPFS = getIPFSUri(imageCid);

      // b) Mettre à jour les métadonnées avec l'image IPFS
      metadata.image = imageUriIPFS;

      // c) Upload des métadonnées JSON sur IPFS
      ipfsCID = await uploadMetadataToIPFS(metadata);
      ipfsURI = getIPFSUri(ipfsCID);
      
      console.log("✅ Badge prêt pour mint:", ipfsURI);
    } catch (ipfsError) {
      console.warn("⚠️ IPFS échoué, fallback vers URI local:", ipfsError);
      ipfsURI = `https://skillbadge.vercel.app/api/badge/${typeId}`;
    }

    // 5. Mint sur la blockchain
    let blockchainResult = { success: false, txHash: null, blocNumber: null };
    
    try {
      const connectedWallet = await connectWallet();
      
      if (connectedWallet && connectedWallet.toLowerCase() === formateurWallet.toLowerCase()) {
        blockchainResult = await mintBadgeOnChain(
          apprenantWallet,
          BigInt(badgeId),
          ipfsURI  // ← Maintenant contient l'URI IPFS réel !
        );
        
        if (blockchainResult.success) {
          console.log("✅ Blockchain:", blockchainResult.txHash);
        }
      }
    } catch (blockchainError) {
      console.warn("⚠️ Erreur blockchain (fallback):", blockchainError);
    }

    // 7. Enregistrer dans Firebase (TOUJOURS fait, même si blockchain échoue)
    const nouveauRef = push(ref(db, "badges"));
    await set(nouveauRef, {
      typeId,
      nom,
      domaine,
      niveau,
      apprenantId,
      apprenantNom,
      apprenantWallet,
      apprenantEmail,
      formateurId,
      formateurNom,
      organisation,
      score,
      commentaire,
      dateEmission: maintenant,
      dateExpiration,
      statut: "actif",

      // Données blockchain RÉELLES (ou fallback mock)
      nftHash: blockchainResult.txHash || genererHashNFT(),
      blocNumber: blockchainResult.blocNumber || genererBlocNumber(),
      txHash: blockchainResult.txHash || genererHashNFT(),
      ipfsCID: ipfsCID || "",
      ipfsURI: ipfsURI || "",
      blockchainUsed: blockchainResult.success, // Pour savoir si c'était réel ou mock
    });

    return {
      succes: true,
      id: nouveauRef.key,
      blockchain: blockchainResult.success,
      txHash: blockchainResult.txHash,
    };
  } catch (e) {
    console.error("❌ Erreur attribuerBadge:", e);
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LES BADGES D'UN APPRENANT (une seule fois)
// ─────────────────────────────────────────────────────────
export async function getBadgesApprenant(apprenantId) {
  const snapshot = await get(ref(db, "badges"));
  if (!snapshot.exists()) return [];

  const tous = snapshot.val();
  return Object.entries(tous)
    .filter(([, v]) => v.apprenantId === apprenantId)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.dateEmission - a.dateEmission);
}

// ─────────────────────────────────────────────────────────
//  ÉCOUTER EN TEMPS RÉEL les badges d'un apprenant
//  ⭐ C'est ce qui permet la démo live :
//  le badge apparaît instantanément après attribution
// ─────────────────────────────────────────────────────────
export function ecouterBadgesApprenant(apprenantId, callback) {
  const badgesRef = ref(db, "badges");
  return onValue(badgesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const tous = snapshot.val();
    const badges = Object.entries(tous)
      .filter(([, v]) => v.apprenantId === apprenantId)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.dateEmission - a.dateEmission);
    callback(badges);
  });
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LES BADGES ÉMIS PAR UN FORMATEUR
// ─────────────────────────────────────────────────────────
export async function getBadgesFormateur(formateurId) {
  const snapshot = await get(ref(db, "badges"));
  if (!snapshot.exists()) return [];

  const tous = snapshot.val();
  return Object.entries(tous)
    .filter(([, v]) => v.formateurId === formateurId)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.dateEmission - a.dateEmission);
}

// ─────────────────────────────────────────────────────────
//  VÉRIFIER UN BADGE PAR WALLET (portail recruteur)
//  Retourne tous les badges actifs d'un apprenant
// ─────────────────────────────────────────────────────────
export async function verifierBadgesParWallet(wallet) {
  const snapshot = await get(ref(db, "badges"));
  if (!snapshot.exists()) return [];

  const w = (wallet || "").toLowerCase();
  const tous = snapshot.val();
  return Object.entries(tous)
    .filter(([, v]) => (v.apprenantWallet || "").toLowerCase() === w)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.dateEmission - a.dateEmission);
}

// ─────────────────────────────────────────────────────────
//  VÉRIFIER UN BADGE PAR ID (portail recruteur)
// ─────────────────────────────────────────────────────────
export async function verifierBadgeParId(badgeId) {
  const snapshot = await get(ref(db, `badges/${badgeId}`));
  if (!snapshot.exists()) return null;
  return { id: badgeId, ...snapshot.val() };
}

// ─────────────────────────────────────────────────────────
//  RÉVOQUER UN BADGE (formateur)
// ─────────────────────────────────────────────────────────
export async function revoquerBadge(badgeId) {
  try {
    await update(ref(db, `badges/${badgeId}`), { statut: "révoqué" });
    return { succes: true };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  UTILITAIRE — Formater une date timestamp en français
// ─────────────────────────────────────────────────────────
export function formaterDate(timestamp) {
  if (!timestamp) return "Illimité";
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────
//  UTILITAIRE — Couleur selon niveau
// ─────────────────────────────────────────────────────────
export function couleurNiveau(niveau) {
  const couleurs = {
    Débutant: { bg: "#eafaf1", color: "#1e8449" },
    Intermédiaire: { bg: "#e8f1fb", color: "#0a66c2" },
    Avancé: { bg: "#fef5ec", color: "#d35400" },
    Expert: { bg: "#f0eeff", color: "#5b3eb5" },
  };
  return couleurs[niveau] || { bg: "#f0f4f9", color: "#555" };
}

// ─────────────────────────────────────────────────────────
//  UTILITAIRE — Couleur hexagonale selon domaine
// ─────────────────────────────────────────────────────────
export function couleurDomaine(domaine) {
  const couleurs = {
    "Développement Web": "#c8e0fb",
    "Développement Mobile": "#c8f0e0",
    "Data Science": "#fce8c8",
    "Data & IA": "#fce8c8",
    "Design UI/UX": "#d8ccf8",
    "UI/UX Design": "#d8ccf8",
    Cybersécurité: "#f8d0d8",
    Mobile: "#c8f0e0",
    DevOps: "#d0eef8",
    Blockchain: "#d0eef8",
    "Marketing Digital": "#fde8d0",
  };
  return couleurs[domaine] || "#e0e8f4";
}
