# SkillBadge — Certification Blockchain des Compétences Autodidactes

> Plateforme hybride Web2/Web3 pour valider, émettre et vérifier des compétences sur la blockchain Polygon.
> **MIABE Hackathon 2026 — Phase 3 (MVP)**

🌐 [Application Live](https://skil-badge.vercel.app/) &nbsp;|&nbsp; 📜 [Smart Contract](https://amoy.polygonscan.com/address/0xC72A58DeeAff2ABc6D3bD18e8184CCDd2014107a) &nbsp;|&nbsp; &nbsp;|&nbsp; 📂 [Architecture](#️-architecture--stack-technique)

---

## 📖 Description

**SkillBadge** résout la problématique de la **vérification des compétences informelles au Burkina Faso**. En combinant la rapidité de **Firebase (Web2)** et l'immutabilité de **Polygon Amoy (Web3)**, la plateforme offre :

- 👩‍🎓 Aux **autodidactes** : des badges NFT vérifiables, partageables et infalsifiables.
- 👨‍🏫 Aux **formateurs** : un outil d'émission sécurisé avec contrôle d'accès on-chain.
- 💼 Aux **recruteurs** : un portail de vérification instantanée accessible via lien public, sans compte requis.

Architecture **100 % hybride** : UX temps réel et indexation rapide via Firebase, preuve de certification ancrée sur la blockchain.

---

## Fonctionnalités Clés

| Module | Fonctionnalité | Statut |
|--------|----------------|--------|
| **Auth Multi-rôles** | Inscription/Connexion — Apprenant, Formateur, Recruteur, Admin | ✅ Live |
| **Mint On-Chain** | Émission ERC-1155 sur Polygon Amoy + Métadonnées IPFS | ✅ Live |
| **Vérification Publique** | Lien de partage accessible sans compte (Mode Invité) | ✅ Live |
| **Workflow Demandes** | Apprenant soumet → Formateur valide/émet ou refuse, en temps réel | ✅ Live |
| **Sécurité Hybride** | Whitelist on-chain (`isFormateur`) + Règles Firebase strictes | ✅ Live |
| **Portail Recruteur** | Recherche par wallet/nom/email + vérification `balanceOf` en direct | ✅ Live |
| **Interface Admin** | Approbation des formateurs + gestion des accès | ✅ Live |

---

## Architecture & Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | HTML / CSS / JS (ES Modules) + Tailwind CDN | Interface utilisateur, routing, manipulation DOM |
| **Backend / DB** | Firebase 10.8.0 (Auth + Realtime Database) | Gestion profils, demandes, indexation, temps réel |
| **Blockchain** | Polygon Amoy Testnet + Solidity (ERC-1155) | Certification immuable, mint, vérification publique |
| **Web3 Lib** | Ethers.js v6 | Interaction contrat, connexion MetaMask, lecture on-chain |
| **Storage** | IPFS via Pinata | Hébergement décentralisé des images & métadonnées JSON |
| **Déploiement** | Vercel | Hébergement HTTPS, CI/CD automatique, optimisation CDN |

### 📁 Structure du Projet

```
skillbadge-phase3/
├── index.html              # Page de connexion / inscription
├── formateur.html          # Dashboard formateur (émission + demandes)
├── portfolio.html          # Portfolio apprenant (badges + partage)
├── verify.html             # Portail recruteur & vérification publique
├── js/
│   ├── firebase.js         # Configuration Firebase (CDN)
│   ├── auth.js             # Inscription, connexion, gestion profils
│   ├── badges.js           # CRUD badges + logique hybride Web2/Web3
│   ├── web3.js             # Connexion MetaMask + mint on-chain
│   ├── ipfs.js             # Upload métadonnées / images vers Pinata
│   └── demandes.js         # Gestion temps réel des demandes
└── vercel.json             # Routing statique Vercel
```

---

## Parcours Utilisateurs

### 👨‍🎓 Apprenant
1. S'inscrit avec email + **adresse wallet obligatoire**
2. Soumet une demande de validation à un formateur
3. Reçoit le badge NFT dans son portfolio dès validation
4. Génère un **lien public** (`verify.html?wallet=0x...`) à partager avec les recruteurs

### 👨‍🏫 Formateur
1. S'inscrit → connecte MetaMask → **approuvé par l'Admin**
2. Reçoit les demandes d'apprenants en temps réel
3. Vérifie son éligibilité (wallet whitelisté on-chain via `isFormateur`)
4. Émet le badge : Upload IPFS → Mint ERC-1155 → Enregistrement Firebase

### 💼 Recruteur
1. Reçoit un lien de vérification ou accède directement au portail
2. Recherche un candidat par **wallet, nom ou email**
3. Consulte le portfolio avec **preuve on-chain** (`balanceOf` + lien Polygonscan)
4. Exporte ou partage les informations sans créer de compte (Mode Invité)

### 🛡️ Admin
1. Approuve ou refuse les demandes de formateurs
2. Gère la whitelist du contrat via `setFormateur(address, bool)`
3. Supervise l'activité globale et les règles de sécurité

---

## Installation & Test Local

> ⚠️ **Prérequis** : Navigateur moderne (Chrome, Edge ou Firefox) + Extension **MetaMask** installée

```bash
# 1. Cloner le dépôt
git clone https://github.com/avatGit/SkilBadge.git
cd SkilBadge

# 2. Lancer un serveur local (obligatoire pour les ES Modules)
npx serve .
# ou utiliser l'extension "Live Server" dans VS Code

# 3. Ouvrir dans le navigateur
# http://localhost:3000
```

### 🔧 Configuration

| Fichier | Ce qui s'y configure |
|---------|----------------------|
| `js/firebase.js` | Clés publiques Firebase |
| `js/ipfs.js` | JWT Pinata (permissions `pinJSON` / `pinFile`) |
| `js/web3.js` | Adresse du contrat & ABI |

> Aucune dépendance `npm` requise — tout passe par CDN.

> 🔒 **Sécurité** : L'accès est contrôlé par les **Règles Firebase Realtime Database** et la fonction `isFormateur()` du contrat. Aucun secret critique n'est exposé côté client pour cette phase.

---

## 📜 Smart Contract

| Paramètre | Valeur |
|-----------|--------|
| **Adresse** | `0xC72A58DeeAff2ABc6D3bD18e8184CCDd2014107a` |
| **Réseau** | Polygon Amoy Testnet (Chain ID : `80002`) |
| **Standard** | ERC-1155 (Multi-Token) |
| **Fonctions clés** | `mint(address to, uint256 id, string uri)` · `isFormateur(address)` · `setFormateur(address, bool)` |
| **Explorateur** | [Voir sur Polygonscan Amoy ↗](https://amoy.polygonscan.com/address/0xC72A58DeeAff2ABc6D3bD18e8184CCDd2014107a) |

---

## 📄 Licence

Ce projet est open-source sous licence **MIT**.
Utilisation autorisée pour démonstration, audit et extension communautaire.

---

> 💡 *SkillBadge : transformer l'expérience informelle en preuve digitale vérifiable.*
