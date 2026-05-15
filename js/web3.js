import { uploadMetadataToIPFS } from "./ipfs.js";

// CONFIGURATION (À mettre à jour après déploiement du contrat)
export const CONTRACT_ADDRESS = "0xC72A58DeeAff2ABc6D3bD18e8184CCDd2014107a"; // Adresse du contrat déployé sur Amoy
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [{ "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "uint256", "name": "balance", "type": "uint256" }, { "internalType": "uint256", "name": "needed", "type": "uint256" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ERC1155InsufficientBalance", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "approver", "type": "address" }], "name": "ERC1155InvalidApprover", "type": "error" },
  { "inputs": [{ "internalType": "uint256", "name": "idsLength", "type": "uint256" }, { "internalType": "uint256", "name": "valuesLength", "type": "uint256" }], "name": "ERC1155InvalidArrayLength", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }], "name": "ERC1155InvalidOperator", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }], "name": "ERC1155InvalidReceiver", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "sender", "type": "address" }], "name": "ERC1155InvalidSender", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "address", "name": "owner", "type": "address" }], "name": "ERC1155MissingApprovalForAll", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }], "name": "ApprovalForAll", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": false, "internalType": "string", "name": "uri", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "BadgeMinted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256[]", "name": "ids", "type": "uint256[]" }, { "indexed": false, "internalType": "uint256[]", "name": "values", "type": "uint256[]" }], "name": "TransferBatch", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "TransferSingle", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "string", "name": "value", "type": "string" }, { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "URI", "type": "event" },
  { "inputs": [], "name": "CYBERSEC", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "DATA_AI", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "DEVOPS", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "MOBILE_DEV", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "UIUX", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "WEB_DEV", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }, { "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address[]", "name": "accounts", "type": "address[]" }, { "internalType": "uint256[]", "name": "ids", "type": "uint256[]" }], "name": "balanceOfBatch", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "isFormateur", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "string", "name": "_uri", "type": "string" }], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256[]", "name": "ids", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "values", "type": "uint256[]" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "safeBatchTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint256", "name": "value", "type": "uint256" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "formateur", "type": "address" }, { "internalType": "bool", "name": "status", "type": "bool" }], "name": "setFormateur", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }], "name": "supportsInterface", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "uri", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

/** Chain ID officiel Polygon Amoy (testnet) */
const POLYGON_AMOY_CHAIN_ID = 80002n;

/** 80002 en hex (0x13882) pour wallet_switchEthereumChain / wallet_addEthereumChain */
const POLYGON_AMOY_CHAIN_ID_HEX = "0x13882";

let provider, signer, contract;

// ─────────────────────────────────────────────────────────
//  Provider EIP-1193 : privilégier MetaMask si plusieurs wallets
//  (réduit les conflits type evmAsk / sélection d’extension)
// ─────────────────────────────────────────────────────────
function getInjectedEthereum() {
  const { ethereum } = window;
  if (!ethereum) return null;
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    const mm = ethereum.providers.find((p) => p && p.isMetaMask);
    if (mm) return mm;
  }
  return ethereum;
}

/**
 * Ajoute Polygon Amoy dans MetaMask si la chaîne n’existe pas encore.
 * Appelé quand wallet_switchEthereumChain renvoie l’erreur 4902.
 */
export async function ajouterPolygonAmoy() {
  const eth = getInjectedEthereum();
  if (!eth) {
    throw new Error("Aucun portefeuille injecté (installez MetaMask).");
  }
  await eth.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: POLYGON_AMOY_CHAIN_ID_HEX,
        chainName: "Polygon Amoy",
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
        rpcUrls: ["https://rpc-amoy.polygon.technology/"],
        blockExplorerUrls: ["https://amoy.polygonscan.com/"],
      },
    ],
  });
}

/**
 * Passe le wallet injecté sur Polygon Amoy (switch, ou add + switch si besoin).
 */
async function ensurePolygonAmoyNetwork(eth) {
  const browserProvider = new ethers.BrowserProvider(eth);
  const { chainId } = await browserProvider.getNetwork();
  if (chainId === POLYGON_AMOY_CHAIN_ID) return;

  try {
    // 1) Demander le changement de réseau vers Amoy
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_AMOY_CHAIN_ID_HEX }],
    });
  } catch (err) {
    // 4902 : la chaîne n’est pas listée dans MetaMask → l’ajouter puis réessayer
    const code = err?.code;
    const isUnknownChain =
      code === 4902 || code === "4902" || code === -32603 || code === "-32603";
    if (err && isUnknownChain) {
      await ajouterPolygonAmoy();
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_AMOY_CHAIN_ID_HEX }],
      });
    } else {
      throw err;
    }
  }

  // Vérifier après action utilisateur (MetaMask peut mettre un court délai)
  const p2 = new ethers.BrowserProvider(eth);
  const { chainId: after } = await p2.getNetwork();
  if (after !== POLYGON_AMOY_CHAIN_ID) {
    throw new Error(
      "Le réseau actif n’est pas Polygon Amoy (80002). Sélectionnez-le manuellement dans MetaMask."
    );
  }
}

/**
 * Traduit les erreurs courantes EIP-1193 / MetaMask en français.
 */
export function traduireErreurWeb3(error) {
  if (!error) return "Erreur inconnue liée au portefeuille.";
  const code = error.code;
  const codeNum = typeof code === "string" ? Number(code) : code;
  const msg = (error.message || error.reason || String(error)).toLowerCase();

  if (code === 4001 || codeNum === 4001 || code === "4001") {
    return "Connexion refusée : vous avez annulé la demande dans MetaMask.";
  }
  if (code === 4100) {
    return "Autorisation expirée ou refusée. Réessayez depuis MetaMask.";
  }
  if (code === -32602) {
    return "Paramètres invalides pour le réseau. Réessayez ou ajoutez Polygon Amoy manuellement.";
  }
  if (code === 4902) {
    return "Polygon Amoy n’était pas configuré ; une tentative d’ajout a été faite.";
  }
  if (/evmAsk|unexpected error|request/i.test(msg)) {
    return "Conflit avec l’extension portefeuille. Fermez les autres wallets, ou choisissez MetaMask comme portefeuille par défaut, puis réessayez sur Polygon Amoy (chain ID 80002).";
  }
  if (error.message) return error.message;
  return "Erreur lors de la connexion au portefeuille.";
}

/**
 * Lit le chainId courant (eth_chainId) sans popup — utile à l’affichage de la page.
 * @returns {Promise<bigint|null>}
 */
export async function lireChainIdMetaMask() {
  const eth = getInjectedEthereum();
  if (!eth) return null;
  try {
    const hex = await eth.request({ method: "eth_chainId" });
    return BigInt(hex);
  } catch {
    return null;
  }
}

/**
 * Connexion MetaMask + réseau Polygon Amoy + initialisation signer/contrat.
 * @returns {Promise<string>} Adresse checksummée
 */
export async function connectWallet() {
  const eth = getInjectedEthereum();
  if (!eth) {
    throw new Error("MetaMask (ou un portefeuille compatible) n’est pas détecté.");
  }

  try {
    // 1) Autoriser l’accès au compte (popup MetaMask)
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts.length) {
      throw new Error("Aucun compte Ethereum n’a été renvoyé par MetaMask.");
    }

    // 2) S’assurer que nous sommes sur Polygon Amoy (switch / add chain)
    await ensurePolygonAmoyNetwork(eth);

    // 3) Recréer le provider après un éventuel changement de chaîne
    provider = new ethers.BrowserProvider(eth);
    const net = await provider.getNetwork();
    if (net.chainId !== POLYGON_AMOY_CHAIN_ID) {
      throw new Error(
        "Le réseau actif n’est toujours pas Polygon Amoy. Vérifiez MetaMask (chain ID 80002)."
      );
    }

    // 4) Signer + contrat (utilisés par mintBadgeOnChain côté formateur)
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    return await signer.getAddress();
  } catch (error) {
    const friendly = traduireErreurWeb3(error);
    const wrapped = new Error(friendly);
    wrapped.cause = error;
    throw wrapped;
  }
}

/**
 * Vérifie si une adresse est whitelistée comme formateur sur le contrat.
 */
export async function checkFormateurWhitelisted(wallet) {
  try {
    if (!wallet) return false;

    // On s'assure d'avoir un provider/contrat
    let targetContract = contract;
    if (!targetContract) {
      const eth = window.ethereum;
      if (!eth) return false;
      const browserProvider = new ethers.BrowserProvider(eth);
      targetContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, browserProvider);
    }

    const isAllowed = await targetContract.isFormateur(wallet);
    console.log(`🔐 Whitelist check for ${wallet}:`, isAllowed);
    return isAllowed;
  } catch (e) {
    console.error("❌ Erreur checkFormateurWhitelisted:", e);
    return false;
  }
}

// 2. Mint du Badge (La fonction clé)
/**
 * @param {string} apprenantWallet - Adresse Ethereum de l'apprenant
 * @param {bigint} domaineId - ID du domaine (0-5) en BigInt
 * @param {string} metadataUri - URI complète IPFS ou fallback (déjà construite dans badges.js)
 */
export async function mintBadgeOnChain(apprenantWallet, domaineId, metadataUri) {
  try {
    if (!contract || !signer) {
      return {
        success: false,
        error:
          "Portefeuille non prêt. Connectez MetaMask sur Polygon Amoy avant de minter.",
      };
    }

    // L'URI est passée directement (elle contient déjà le lien IPFS ou fallback)
    const uri = metadataUri;

    // Transaction réelle sur la blockchain
    const tx = await contract.mint(apprenantWallet, domaineId, uri);

    // Attendre la confirmation
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blocNumber: receipt.blockNumber, // alias pour compatibilité badges.js
    };
  } catch (error) {
    console.error("Erreur Blockchain:", error);

    const msg = error.reason || error.message || "";
    if (msg.includes("Seul un formateur habilité")) {
      return {
        success: false,
        error: "Votre wallet n'est pas autorisé. Contactez l'admin pour être whitelisté sur le contrat."
      };
    }

    return { success: false, error: msg };
  }
}