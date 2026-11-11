const { randomBytes, createHash } = require("node:crypto");
const { Op } = require("sequelize");

const INVITATION_PURPOSE = "DOCTOR_INVITATION";
const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 3;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function invitationUrl(token, baseUrl) {
  return new URL(`/invitacion-medico/${encodeURIComponent(token)}`, baseUrl).toString();
}

async function getActiveSpecialties({ models }) {
  if (!models?.Specialty?.findAll) return { status: "unavailable", specialties: [] };
  try {
    const specialties = await models.Specialty.findAll({
      where: { status: "ACTIVE" },
      attributes: ["id", "name"],
      order: [["name", "ASC"]]
    });
    return { status: "ready", specialties };
  } catch {
    return { status: "error", specialties: [] };
  }
}

async function createDoctorInvitation({ sequelize, models, input, actorUserId, emailSender, baseUrl, now = new Date() }) {
  if (!sequelize || !models?.User || !models?.Doctor || !models?.Specialty || !models?.AccountToken || !models?.NotificationOutbox) {
    return { status: "unavailable" };
  }
  const normalized = {
    ...input,
    documentNumber: String(input.documentNumber || "").trim().replace(/\s+/g, "").toUpperCase(),
    email: String(input.email || "").trim().toLowerCase(),
    professionalRegistration: String(input.professionalRegistration || "").trim().toUpperCase()
  };
  const token = randomBytes(32).toString("base64url");
  const created = await sequelize.transaction(async (transaction) => {
    const specialty = await models.Specialty.findByPk(normalized.specialtyId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!specialty || specialty.status !== "ACTIVE") return { status: "specialty_unavailable" };

    const existingEmail = await models.User.findOne({ where: { email: normalized.email }, transaction, lock: transaction.LOCK.UPDATE });
    if (existingEmail) return { status: "email_in_use" };
    const existingDocument = await models.User.findOne({
      where: { documentType: normalized.documentType, documentNumber: normalized.documentNumber },
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (existingDocument) return { status: "document_in_use" };
    const existingRegistration = await models.Doctor.findOne({
      where: { professionalRegistration: normalized.professionalRegistration },
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (existingRegistration) return { status: "registration_in_use" };

    const user = await models.User.create({
      documentType: normalized.documentType,
      documentNumber: normalized.documentNumber,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email,
      phone: normalized.phone,
      passwordHash: null,
      passwordConfiguredAt: null,
      role: "DOCTOR",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null
    }, { transaction });
    const doctor = await models.Doctor.create({
      userId: user.id,
      specialtyId: specialty.id,
      professionalRegistration: normalized.professionalRegistration
    }, { transaction });
    const accountToken = await models.AccountToken.create({
      userId: user.id,
      purpose: INVITATION_PURPOSE,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      usedAt: null
    }, { transaction });
    const notification = await models.NotificationOutbox.create({
      accountTokenId: accountToken.id,
      recipient: normalized.email,
      notificationType: INVITATION_PURPOSE,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0
    }, { transaction });
    return {
      status: "created", userId: user.id, doctorId: doctor.id,
      notificationId: notification.id, recipient: normalized.email, firstName: normalized.firstName
    };
  });

  if (created.status !== "created") return created;
  if (!emailSender) {
    await models.NotificationOutbox.update({ status: "FAILED", lastError: "SMTP_NOT_CONFIGURED" }, { where: { id: created.notificationId } });
    return { status: "created", deliveryFailed: true };
  }
  let attempts = 0;
  while (attempts < MAX_DELIVERY_ATTEMPTS) {
    attempts += 1;
    try {
      await emailSender.sendDoctorInvitationEmail({
        to: created.recipient, firstName: created.firstName,
        url: invitationUrl(token, baseUrl), expiresInHours: 24
      });
      await models.NotificationOutbox.update({ status: "SENT", attempts, sentAt: now, lastError: null }, { where: { id: created.notificationId } });
      return { status: "created", deliveryFailed: false };
    } catch {
      // Reintenta el mismo enlace sin registrar su contenido ni detalles del transporte.
    }
  }
  await models.NotificationOutbox.update({ status: "FAILED", attempts, lastError: "SMTP_DELIVERY_FAILED" }, { where: { id: created.notificationId } });
  return { status: "created", deliveryFailed: true };
}

module.exports = { INVITATION_PURPOSE, INVITATION_TTL_MS, createDoctorInvitation, getActiveSpecialties, hashToken, invitationUrl };
