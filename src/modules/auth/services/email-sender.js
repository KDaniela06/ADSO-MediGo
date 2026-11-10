const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function createEmailSender(environment = process.env) {
  if (!environment.SMTP_HOST || !environment.SMTP_FROM) return null;

  const port = Number(environment.SMTP_PORT) || 587;
  const auth = environment.SMTP_USER && environment.SMTP_PASSWORD
    ? { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD }
    : undefined;
  const transporter = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port,
    secure: environment.SMTP_SECURE === "true" || port === 465,
    auth,
    requireTLS: port !== 465
  });

  return {
    async sendVerificationEmail({ to, firstName, url, expiresInHours }) {
      const safeName = escapeHtml(firstName || "paciente");
      const safeUrl = escapeHtml(url);
      await transporter.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject: "Verifica tu correo en MediGo",
        text: `Hola ${firstName || ""}. Verifica tu correo en este enlace: ${url}. El enlace vence en ${expiresInHours} horas. Si no creaste esta cuenta, ignora este mensaje.`,
        html: `<p>Hola ${safeName},</p><p>Confirma tu correo para activar tu cuenta de MediGo.</p><p><a href="${safeUrl}">Verificar correo</a></p><p>El enlace vence en ${expiresInHours} horas y solo se puede utilizar una vez.</p><p>Si no creaste esta cuenta, ignora este mensaje.</p>`
      });
    }
  };
}

module.exports = { createEmailSender, escapeHtml };

