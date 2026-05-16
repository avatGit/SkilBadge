// ============================================================
//  auth.js — Fonctions d'authentification SkillBadge
//  Inscription, connexion, déconnexion, profil utilisateur
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  ref,
  set,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { auth, db } from "./firebase.js";

// Les fonctions genererWallet() et mocks blockchain sont supprimées en Phase 3 
// au profit de l'utilisation réelle de MetaMask et de la blockchain.

// ── Générer un faux hash NFT ───────────────────────────────
export function genererHashNFT() {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// ── Générer un faux numéro de bloc ────────────────────────
export function genererBlocNumber() {
  return Math.floor(17000000 + Math.random() * 2000000);
}

// ─────────────────────────────────────────────────────────
//  INSCRIPTION
//  role : "formateur" | "apprenant" | "recruteur"
// ─────────────────────────────────────────────────────────
export async function inscrire({
  nom,
  email,
  motDePasse,
  role,
  organisation = "",
  // Champs supplémentaires formateur
  portfolioUrl = "",
  preuveSociale = "",
  adresseCentre = "",
  // Wallet blockchain (OBLIGATOIRE en Phase 3 pour apprenant/formateur)
  wallet = "",
}) {
  try {
    // 1. Validation du wallet pour les rôles actifs sur la blockchain
    if (role === "apprenant" || role === "formateur") {
      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return { succes: false, erreur: "Une adresse wallet blockchain valide (0x...) est requise." };
      }
    }

    // 2. Créer le compte Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, motDePasse);
    const user = userCredential.user;

    // 3. Construire le profil (wallet forcé en minuscules)
    const profil = {
      nom,
      email,
      role,
      organisation,
      wallet: wallet ? wallet.toLowerCase() : "",
      createdAt: Date.now(),
    };

    // 4. Champs spécifiques au rôle formateur
    if (role === "formateur") {
      profil.statut = "en_attente";  // Doit être approuvé par l'admin
      profil.approuvePar = null;
      profil.portfolioUrl = portfolioUrl;
      profil.preuveSociale = preuveSociale;
      profil.adresseCentre = adresseCentre;
    }

    // 5. Sauvegarder le profil dans la Realtime Database
    await set(ref(db, `utilisateurs/${user.uid}`), profil);

    // 6. Envoyer email de confirmation (formateur uniquement)
    if (role === "formateur") {
      try {
        const { envoyerEmailInscription } = await import("./email.js");
        await envoyerEmailInscription({ toEmail: email, nom });
      } catch (emailErr) {
        console.warn("Email de confirmation non envoyé :", emailErr);
        // On ne bloque pas l'inscription si l'email échoue
      }
    }

    return { succes: true, user, role };

  } catch (erreur) {
    return { succes: false, erreur: traduireErreur(erreur.code) };
  }
}

// ─────────────────────────────────────────────────────────
//  CONNEXION
// ─────────────────────────────────────────────────────────
export async function connecter({ email, motDePasse }) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, motDePasse);
    return { succes: true, user: userCredential.user };
  } catch (erreur) {
    return { succes: false, erreur: traduireErreur(erreur.code) };
  }
}

// ─────────────────────────────────────────────────────────
//  DÉCONNEXION
// ─────────────────────────────────────────────────────────
export async function deconnecter() {
  try {
    sessionStorage.clear();
    localStorage.removeItem("skillbadge_session");
    await signOut(auth);
    return { succes: true };
  } catch (erreur) {
    return { succes: false, erreur: traduireErreur(erreur.code) };
  }
}

// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LE PROFIL D'UN UTILISATEUR
// ─────────────────────────────────────────────────────────
export async function getProfil(uid) {
  const snapshot = await get(ref(db, `utilisateurs/${uid}`));
  if (snapshot.exists()) {
    return { ...snapshot.val(), uid };
  }
  return null;
}

// ─────────────────────────────────────────────────────────
//  METTRE À JOUR DES CHAMPS DU PROFIL (nom, organisation, etc.)
// ─────────────────────────────────────────────────────────
export async function mettreAJourProfil(uid, champs) {
  try {
    const autorises = ["nom", "organisation", "portfolioUrl", "preuveSociale", "adresseCentre"];
    const payload = {};
    for (const k of autorises) {
      if (champs[k] !== undefined) payload[k] = champs[k];
    }
    if (Object.keys(payload).length === 0) {
      return { succes: false, erreur: "Aucun champ modifiable fourni." };
    }
    await update(ref(db, `utilisateurs/${uid}`), payload);
    return { succes: true };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  VÉRIFIER SI UN FORMATEUR EST APPROUVÉ
// ─────────────────────────────────────────────────────────
export async function isFormateurApprouve(uid) {
  const profil = await getProfil(uid);
  if (!profil) return false;
  return profil.role === "formateur" && profil.statut === "approuve";
}

// ─────────────────────────────────────────────────────────
//  LIER UN WALLET BLOCKCHAIN RÉEL À UN COMPTE
//  Appelé quand l'apprenant connecte MetaMask dans son profil
// ─────────────────────────────────────────────────────────
export async function lierWallet(uid, walletAddress) {
  try {
    // Validation basique du format Ethereum
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return { succes: false, erreur: "Adresse wallet invalide" };
    }

    // Mise à jour dans Firebase (horodatage pour timeline apprenant)
    await update(ref(db, `utilisateurs/${uid}`), {
      wallet: walletAddress,
      walletUpdatedAt: Date.now()
    });

    return { succes: true, wallet: walletAddress };
  } catch (e) {
    return { succes: false, erreur: e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  VÉRIFIER SI UN UTILISATEUR A UN WALLET CONNECTÉ
// ─────────────────────────────────────────────────────────
export async function aWalletConnecte(uid) {
  const profil = await getProfil(uid);
  if (!profil) return false;

  // Un wallet "réel" commence par 0x et fait 42 caractères
  // (les placeholders générés peuvent être filtrés si besoin)
  return /^0x[a-fA-F0-9]{40}$/.test(profil.wallet);
}


// ─────────────────────────────────────────────────────────
//  RÉCUPÉRER LE PROFIL PAR WALLET
//  (utilisé par le portail recruteur)
// ─────────────────────────────────────────────────────────
export async function getProfilParWallet(wallet) {
  const snapshot = await get(ref(db, "utilisateurs"));
  if (!snapshot.exists()) return null;

  const utilisateurs = snapshot.val();
  for (const uid in utilisateurs) {
    if (utilisateurs[uid].wallet === wallet) {
      return { ...utilisateurs[uid], uid };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────
//  OBSERVER L'ÉTAT DE CONNEXION
//  Appeler au chargement de chaque page
// ─────────────────────────────────────────────────────────
export function observerConnexion(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profil = await getProfil(user.uid);
      callback(user, profil);
    } else {
      callback(null, null);
    }
  });
}

// ─────────────────────────────────────────────────────────
//  TRADUCTION DES ERREURS FIREBASE → Français
// ─────────────────────────────────────────────────────────
function traduireErreur(code) {
  const erreurs = {
    "auth/email-already-in-use": "Cette adresse e-mail est déjà utilisée.",
    "auth/invalid-email": "L'adresse e-mail n'est pas valide.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/user-not-found": "Aucun compte trouvé avec cet e-mail.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/network-request-failed": "Problème de connexion réseau."
  };
  return erreurs[code] || "Une erreur est survenue. Veuillez réessayer.";
}

// Export global pour le mode invité
window.getProfilParWallet = getProfilParWallet;
