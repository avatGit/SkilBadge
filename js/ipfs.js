// ============================================================
//  ipfs.js — Upload vers Pinata IPFS (Images & Métadonnées)
//  Compatible navigateur (ES Modules) + ERC-1155 standard
// ============================================================

// ⚠️ Remplace par ton JWT Pinata (récupéré sur app.pinata.cloud → API Keys → JWT)
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhNzQ3NDdlZi1jMWNhLTQ4ZjMtYmVlMy01NjBmNjU1ZGEzZDMiLCJlbWFpbCI6ImRhbmtmZDk5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI3M2NlNTFmYmJiZTc5ZDYxYzE3ZiIsInNjb3BlZEtleVNlY3JldCI6IjNiN2U5YmMwODczZjBmOWU3Nzc2ZmMyZTQ0NDk5MmE3NDZlOTNlNTg5Y2E0NzVhNWU0NzExODQ3ZTUyZjdlNGQiLCJleHAiOjE4MTAzMDc5NjB9.lQ88kbQ3O22n3gdNx_bUI8z_x0k7FLc-9e5h6H3QIYI";
const PINATA_BASE = "https://api.pinata.cloud";

// ─────────────────────────────────────────────────────────
//  1. UPLOAD DE MÉTADONNÉES JSON (pour ERC-1155)
// ─────────────────────────────────────────────────────────
export async function uploadMetadataToIPFS(metadata) {
  try {
    const response = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name: `skillbadge-meta-${Date.now()}` }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.details || "Erreur Pinata JSON");
    }

    const data = await response.json();
    return data.IpfsHash; // Retourne le CID
  } catch (error) {
    console.error("❌ Erreur upload JSON IPFS:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
//  2. UPLOAD D'IMAGE (Fichier local / Blob / File)
// ─────────────────────────────────────────────────────────
export async function uploadImageToIPFS(file) {
  if (!file) throw new Error("Aucun fichier fourni");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PINATA_JWT}`
        // ⚠️ Ne pas mettre "Content-Type" ici : le navigateur le gère avec FormData
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.details || "Erreur Pinata Image");
    }

    const data = await response.json();
    return data.IpfsHash;
  } catch (error) {
    console.error("❌ Erreur upload Image IPFS:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
//  3. UTILITAIRE : Construire l'URI IPFS complet
// ─────────────────────────────────────────────────────────
export function getIPFSUri(cid) {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

// ─────────────────────────────────────────────────────────
//  4. FONCTION PRINCIPALE : Préparer & uploader un badge complet
//  Retourne { metaUri, metaCid, imageUri } prêt pour le mint
// ─────────────────────────────────────────────────────────
export async function prepareBadgeForMint({
  domaine,
  niveau,
  formateurNom,
  organisation,
  score,
  imageFile // File object provenant d'un <input type="file">
}) {
  // 1. Upload de l'image (si fournie)
  let imageUri = "";
  if (imageFile) {
    const imageCid = await uploadImageToIPFS(imageFile);
    imageUri = getIPFSUri(imageCid);
  } else {
    // Fallback : image hébergée par défaut si aucune fournie
    imageUri = `https://skillbadge.vercel.app/badges/${domaine.toLowerCase().replace(/ /g, '-')}-${niveau.toLowerCase()}.png`;
  }

  // 2. Créer les métadonnées conformes ERC-1155
  const metadata = {
    name: `${domaine} — ${niveau}`,
    description: `Badge certifié par ${organisation} • Score: ${score}/100`,
    image: imageUri,
    attributes: [
      { trait_type: "Domaine", value: domaine },
      { trait_type: "Niveau", value: niveau },
      { trait_type: "Score", value: score },
      { trait_type: "Émetteur", value: formateurNom },
      { trait_type: "Organisation", value: organisation },
      { trait_type: "Date", value: new Date().toISOString().split("T")[0] }
    ]
  };

  // 3. Upload des métadonnées sur IPFS
  const metaCid = await uploadMetadataToIPFS(metadata);
  const metaUri = getIPFSUri(metaCid);

  console.log("✅ Badge prêt pour mint:", { metaUri, metaCid, imageUri });
  return { metaUri, metaCid, imageUri };
}