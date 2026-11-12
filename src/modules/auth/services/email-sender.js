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
    },

    async sendEmailChangeVerification({ to, firstName, url, expiresInHours }) {
      const safeName = escapeHtml(firstName || "paciente");
      const safeUrl = escapeHtml(url);
      await transporter.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject: "Confirma tu nuevo correo en MediGo",
        text: `Hola ${firstName || ""}. Confirma tu nuevo correo en este enlace: ${url}. El enlace vence en ${expiresInHours} horas. Si no solicitaste este cambio, ignora este mensaje.`,
        html: `<p>Hola ${safeName},</p><p>Recibimos una solicitud para cambiar el correo de tu cuenta de MediGo.</p><p><a href="${safeUrl}">Confirmar nuevo correo</a></p><p>El enlace vence en ${expiresInHours} horas y solo se puede utilizar una vez.</p><p>Si no solicitaste este cambio, ignora este mensaje.</p>`
      });
    },

    async sendDoctorInvitationEmail({ to, firstName, url, expiresInHours }) {
      const safeName = escapeHtml(firstName || "médico");
      const safeUrl = escapeHtml(url);
      await transporter.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject: "Configura tu cuenta médica en MediGo",
        text: `Hola ${firstName || ""}. El administrador de MediGo te invitó a configurar tu cuenta médica: ${url}. El enlace vence en ${expiresInHours} horas y solo se puede utilizar una vez. Si no esperabas esta invitación, ignora este mensaje.`,
        html: `<p>Hola ${safeName},</p><p>El administrador de MediGo creó una cuenta médica para ti.</p><p><a href="${safeUrl}">Configurar mi cuenta</a></p><p>El enlace vence en ${expiresInHours} horas y solo se puede utilizar una vez.</p><p>Si no esperabas esta invitación, ignora este mensaje.</p>`
      });
    },

    async sendPasswordResetEmail({ to, firstName, url, expiresInMinutes }) {
      const safeName = escapeHtml(firstName || "paciente");
      const safeUrl = escapeHtml(url);
      await transporter.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject: "Recupera tu contraseña de MediGo",
        text: `Hola ${firstName || ""}. Puedes crear una nueva contraseña en este enlace: ${url}. El enlace vence en ${expiresInMinutes} minutos y solo se puede utilizar una vez. Si no solicitaste este cambio, ignora este mensaje.`,
        html: `<p>Hola ${safeName},</p><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de MediGo.</p><p><a href="${safeUrl}">Crear una nueva contraseña</a></p><p>El enlace vence en ${expiresInMinutes} minutos y solo se puede utilizar una vez.</p><p>Si no solicitaste este cambio, ignora este mensaje.</p>`
      });
    }
    async sendAccountStatusNotification({ to, firstName, status, changedAccountStatus, impactedRole, cancelledAppointments }) {
      const safeName = escapeHtml(firstName || "");
      const roleName = impactedRole === "DOCTOR" ? "médico" : "paciente";
      const safeRoleName = escapeHtml(roleName);
      const appointmentCount = Number(cancelledAppointments) || 0;
      const isTarget = Boolean(status);
      const statusText = status === "ACTIVE" ? "activada" : "desactivada";
      const subject = isTarget
        ? "Actualización de tu cuenta de MediGo"
        : "Cambio en una cita de MediGo";
      const text = isTarget
        ? `Hola ${firstName || ""}. Un administrador ${status === "ACTIVE" ? "activó" : "desactivó"} tu cuenta de MediGo. Se cancelaron ${appointmentCount} citas futuras confirmadas asociadas a esta cuenta. Si tienes preguntas, comunícate con MediGo.`
        : `Hola ${firstName || ""}. Un administrador desactivó la cuenta de un ${roleName} en MediGo. Se cancelaron ${appointmentCount} citas futuras confirmadas en las que participabas. Comunícate con MediGo si necesitas ayuda.`;
      const html = isTarget
        ? `<p>Hola ${safeName},</p><p>Un administrador ${status === "ACTIVE" ? "activó" : "desactivó"} tu cuenta de MediGo.</p><p>Se cancelaron ${appointmentCount} citas futuras confirmadas asociadas a esta cuenta.</p><p>Si tienes preguntas, comunícate con MediGo.</p>`
        : `<p>Hola ${safeName},</p><p>Un administrador desactivó la cuenta de un ${safeRoleName} en MediGo.</p><p>Se cancelaron ${appointmentCount} citas futuras confirmadas en las que participabas.</p><p>Comunícate con MediGo si necesitas ayuda.</p>`;
      await transporter.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject,
        text,
        html
      });
    },
  };
}

module.exports = { createEmailSender, escapeHtml };
