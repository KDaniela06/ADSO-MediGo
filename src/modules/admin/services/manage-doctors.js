const { Op } = require("sequelize");
const INVITATION_PURPOSE = "DOCTOR_INVITATION";
const PAGE_SIZE = 20;
const ALLOWED_STATUSES = new Set(["PENDING_VERIFICATION", "ACTIVE", "INACTIVE"]);

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 80);
}

function invitationState(token, now = new Date()) {
  if (!token) return { code: "NOT_SENT", label: "Sin invitación", expiresAt: null, sentStatus: null };
  const notification = plain(token.notification) || {};
  if (notification.status === "FAILED") return {
    code: "DELIVERY_FAILED", label: "No enviada", expiresAt: token.expiresAt, sentStatus: notification.status
  };
  if (token.usedAt) return { code: "USED", label: "Utilizada", expiresAt: token.expiresAt, sentStatus: notification.status || null };
  if (new Date(token.expiresAt).getTime() <= now.getTime()) return {
    code: "EXPIRED", label: "Vencida", expiresAt: token.expiresAt, sentStatus: notification.status || null
  };
  return { code: "PENDING", label: "Pendiente", expiresAt: token.expiresAt, sentStatus: notification.status || null };
}

function presentDoctor(record, token, now) {
  const doctor = plain(record);
  const user = plain(doctor?.user) || {};
  const specialty = plain(doctor?.specialty) || {};
  return {
    id: doctor.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    email: user.email,
    pendingEmail: user.pendingEmail || null,
    phone: user.phone,
    accountStatus: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    passwordConfiguredAt: user.passwordConfiguredAt,
    createdAt: user.createdAt,
    specialtyId: doctor.specialtyId,
    specialtyName: specialty.name || "",
    professionalRegistration: doctor.professionalRegistration,
    invitation: invitationState(token, now)
  };
}

function doctorIncludes(models) {
  return [
    {
      model: models.User, as: "user", required: true,
      attributes: ["id", "firstName", "lastName", "documentType", "documentNumber", "email", "pendingEmail", "phone", "role", "status", "emailVerifiedAt", "passwordConfiguredAt", "createdAt"],
      where: { role: "DOCTOR" }
    },
    { model: models.Specialty, as: "specialty", required: false, attributes: ["id", "name", "status"] }
  ];
}

async function invitationTokens({ models, userIds }) {
  if (!userIds.length || !models?.AccountToken?.findAll) return new Map();
  const tokens = await models.AccountToken.findAll({
    where: { userId: { [Op.in]: userIds }, purpose: INVITATION_PURPOSE },
    attributes: ["id", "userId", "createdAt", "expiresAt", "usedAt"],
    include: models.NotificationOutbox ? [{
      model: models.NotificationOutbox, as: "notification", required: false,
      attributes: ["status"]
    }] : [],
    order: [["createdAt", "DESC"]]
  });
  const latest = new Map();
  for (const row of tokens) {
    const token = plain(row);
    if (!latest.has(String(token.userId))) latest.set(String(token.userId), token);
  }
  return latest;
}

async function getAdminDoctors({ models, search = "", status = "", specialtyId = "", page = 1, now = new Date() }) {
  const normalizedSearch = normalizeSearch(search);
  const selectedStatus = ALLOWED_STATUSES.has(status) ? status : "";
  const selectedSpecialty = /^\d+$/.test(String(specialtyId)) ? String(specialtyId) : "";
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const empty = { status: "unavailable", doctors: [], search: normalizedSearch, selectedStatus, selectedSpecialty, page: currentPage, pageCount: 1, total: 0 };
  if (!models?.Doctor?.findAndCountAll || !models?.User || !models?.Specialty || !models?.AccountToken) return empty;
  try {
    const userWhere = { role: "DOCTOR" };
    if (selectedStatus) userWhere.status = selectedStatus;
    const doctorWhere = {};
    if (selectedSpecialty) doctorWhere.specialtyId = selectedSpecialty;
    if (normalizedSearch) {
      const pattern = "%" + normalizedSearch.replace(/[\\%_]/g, "\\$&") + "%";
      doctorWhere[Op.or] = [
        { professionalRegistration: { [Op.like]: pattern } },
        { "$user.firstName$": { [Op.like]: pattern } },
        { "$user.lastName$": { [Op.like]: pattern } },
        { "$user.documentNumber$": { [Op.like]: pattern } },
        { "$user.email$": { [Op.like]: pattern } },
        { "$user.phone$": { [Op.like]: pattern } }
      ];
    }
    const result = await models.Doctor.findAndCountAll({
      attributes: ["id", "userId", "specialtyId", "professionalRegistration"],
      include: doctorIncludes(models).map((include) => include.as === "user" ? { ...include, where: userWhere } : include),
      where: doctorWhere,
      order: [["id", "DESC"]],
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      distinct: true,
      subQuery: false
    });
    const rows = result.rows || [];
    const tokens = await invitationTokens({ models, userIds: rows.map((row) => String(plain(row).userId)) });
    const total = Number(result.count) || 0;
    return {
      status: "ready",
      doctors: rows.map((row) => {
        const doctor = plain(row);
        return presentDoctor(row, tokens.get(String(doctor.userId)), now);
      }),
      search: normalizedSearch, selectedStatus, selectedSpecialty,
      page: currentPage, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), total
    };
  } catch {
    return { ...empty, status: "error" };
  }
}

async function getAdminDoctor({ models, doctorId, now = new Date() }) {
  if (!models?.Doctor?.findByPk || !models?.User || !models?.Specialty || !models?.AccountToken) return { status: "unavailable" };
  if (!/^\d+$/.test(String(doctorId || ""))) return { status: "not_found" };
  try {
    const row = await models.Doctor.findByPk(doctorId, {
      attributes: ["id", "userId", "specialtyId", "professionalRegistration", "professionalDescription"],
      include: doctorIncludes(models)
    });
    if (!row) return { status: "not_found" };
    const doctor = plain(row);
    const tokens = await invitationTokens({ models, userIds: [String(doctor.userId)] });
    return { status: "ready", doctor: presentDoctor(row, tokens.get(String(doctor.userId)), now) };
  } catch {
    return { status: "error" };
  }
}

async function getDoctorSpecialties({ models }) {
  if (!models?.Specialty?.findAll) return { status: "unavailable", specialties: [] };
  try {
    const specialties = await models.Specialty.findAll({ attributes: ["id", "name", "status"], order: [["name", "ASC"]] });
    return { status: "ready", specialties };
  } catch {
    return { status: "error", specialties: [] };
  }
}

async function updateAdminDoctor({ sequelize, models, doctorId, actorUserId, input, confirmed = false, now = new Date() }) {
  if (!sequelize || !models?.Doctor || !models?.User || !models?.Specialty || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\d+$/.test(String(doctorId || ""))) return { status: "not_found" };
  return sequelize.transaction(async (transaction) => {
    const doctor = await models.Doctor.findByPk(doctorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!doctor) return { status: "not_found" };
    const user = await models.User.findByPk(doctor.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "DOCTOR") return { status: "not_found" };
    const specialty = await models.Specialty.findByPk(input.specialtyId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!specialty) return { status: "specialty_unavailable" };
    const registration = String(input.professionalRegistration || "").trim().toUpperCase();
    const duplicate = await models.Doctor.findOne({
      where: { professionalRegistration: registration, id: { [Op.ne]: doctor.id } },
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (duplicate) return { status: "registration_in_use" };
    const changesSpecialty = Number(doctor.specialtyId) !== Number(specialty.id);
    if (changesSpecialty && specialty.status !== "ACTIVE") return { status: "specialty_unavailable" };
    if (changesSpecialty && !confirmed) return { status: "confirmation_required" };

    const beforeData = {
      firstName: user.firstName, lastName: user.lastName, phone: user.phone,
      professionalRegistration: doctor.professionalRegistration, specialtyId: doctor.specialtyId
    };
    user.firstName = input.firstName;
    user.lastName = input.lastName;
    user.phone = input.phone;
    doctor.professionalRegistration = registration;
    doctor.specialtyId = specialty.id;
    const afterData = {
      firstName: user.firstName, lastName: user.lastName, phone: user.phone,
      professionalRegistration: doctor.professionalRegistration, specialtyId: doctor.specialtyId
    };
    const changed = Object.keys(beforeData).some((key) => String(beforeData[key] ?? "") !== String(afterData[key] ?? ""));
    if (!changed) return { status: "unchanged" };
    await user.save({ transaction });
    await doctor.save({ transaction });
    await models.AuditLog.create({
      actorUserId, action: changesSpecialty ? "DOCTOR_SPECIALTY_CHANGED" : "DOCTOR_ADMIN_DATA_UPDATED",
      entityType: "DOCTOR", entityId: doctor.id,
      beforeData, afterData, createdAt: now
    }, { transaction });
    return { status: "saved", specialtyChanged: changesSpecialty };
  });
}

module.exports = {
  ALLOWED_STATUSES, PAGE_SIZE, getAdminDoctor, getAdminDoctors, getDoctorSpecialties,
  invitationState, normalizeSearch, presentDoctor, updateAdminDoctor
};
