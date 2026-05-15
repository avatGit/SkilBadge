// ============================================================
//  email.js — Notifications EmailJS pour SkillBadge
//  Utilisé par l'admin pour notifier les formateurs
// ============================================================

// ⚠️ CONFIGURATION EMAILJS — À remplacer après inscription sur emailjs.com
const EMAILJS_CONFIG = {
  publicKey: "5lnu-utidZnXwQfgP",   // Settings → API Keys → Public Key
  serviceId: "service_rqxzvqh",   // Email Services → Service ID
  templateId: "template_198uxed",  // Email Templates → Template ID
};

let emailjsInitialized = false;

// ── Initialiser EmailJS une seule fois ───────────────────────
async function initEmailJS() {
  if (emailjsInitialized) return true;
  try {
    const { default: emailjs } = await import(
      "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
    );
    window._emailjs = emailjs;
    emailjs.init(EMAILJS_CONFIG.publicKey);
    emailjsInitialized = true;
    return true;
  } catch (e) {
    console.warn("⚠️ EmailJS non disponible :", e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
//  ENVOYER EMAIL D'APPROBATION / REFUS À UN FORMATEUR
//  statut : "approuve" | "refuse"
//  raison : string (optionnel, pour le refus)
// ─────────────────────────────────────────────────────────
export async function envoyerEmailApprobation({ toEmail, nom, statut, raison = "" }) {
  const ok = await initEmailJS();
  if (!ok || !window._emailjs) {
    console.warn("EmailJS indisponible — email non envoyé");
    return { succes: false, erreur: "EmailJS non configuré" };
  }

  const estApprouve = statut === "approuve";

  const templateParams = {
    to_email: toEmail,
    to_name: nom,
    statut: estApprouve ? "approuvée ✅" : "refusée ❌",
    message: estApprouve
      ? "Votre compte formateur SkillBadge est maintenant actif. Vous pouvez vous connecter et commencer à émettre des badges certifiés sur la blockchain."
      : `Votre demande de compte formateur a été refusée.${raison ? ` Raison : ${raison}` : ""} Contactez l'administrateur pour plus d'informations.`,
    app_url: window.location.origin,
  };

  try {
    await window._emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );
    console.log(`✅ Email envoyé à ${toEmail}`);
    return { succes: true };
  } catch (e) {
    console.error("❌ Erreur envoi email :", e);
    return { succes: false, erreur: e.text || e.message };
  }
}

// ─────────────────────────────────────────────────────────
//  ENVOYER EMAIL DE CONFIRMATION D'INSCRIPTION FORMATEUR
//  Appelé juste après la création du compte
// ─────────────────────────────────────────────────────────
export async function envoyerEmailInscription({ toEmail, nom }) {
  const ok = await initEmailJS();
  if (!ok || !window._emailjs) {
    console.warn("EmailJS indisponible — email de confirmation non envoyé");
    return { succes: false, erreur: "EmailJS non configuré" };
  }

  const templateParams = {
    to_email: toEmail,
    to_name: nom,
    statut: "reçue 📬",
    message: "Votre demande d'inscription comme formateur sur SkillBadge a bien été reçue. Un administrateur examinera votre dossier sous 24–48h. Vous recevrez un email dès la décision prise.",
    app_url: window.location.origin,
  };

  try {
    await window._emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );
    return { succes: true };
  } catch (e) {
    console.warn("Email de confirmation non envoyé :", e);
    return { succes: false, erreur: e.text || e.message };
  }
}
