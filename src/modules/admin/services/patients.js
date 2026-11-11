const { Op } = require("sequelize");

const PAGE_SIZE = 20;
const ALLOWED_STATUSES = new Set(["ACTIVE", "INACTIVE", "PENDING_VERIFICATION"]);

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 80);
}

function presentPatient(record) {
  const patient = plain(record);
  const user = plain(patient?.user) || {};
  return {
    id: patient.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    email: user.email,
    phone: user.phone,
    status: user.status,
    city: patient.city || "",
    dateOfBirth: patient.dateOfBirth
  };
}

function patientInclude(models) {
  return [{
    model: models.User,
    as: "user",
    required: true,
    attributes: ["id", "firstName", "lastName", "documentType", "documentNumber", "email", "phone", "status"],
    where: { role: "PATIENT" }
  }];
}

async function getAdminPatients({ models, search = "", status = "", page = 1 }) {
  const normalizedSearch = normalizeSearch(search);
  const selectedStatus = ALLOWED_STATUSES.has(status) ? status : "";
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  if (!models?.Patient?.findAndCountAll || !models?.User || !Op.like) {
    return { status: "unavailable", patients: [], search: normalizedSearch, selectedStatus, page: currentPage, pageCount: 1, total: 0 };
  }

  try {
    const where = {};
    if (selectedStatus) where.status = selectedStatus;
    if (normalizedSearch) {
      const pattern = "%" + normalizedSearch.replace(/[\\%_]/g, "\\$&") + "%";
      where[Op.or] = [
        { firstName: { [Op.like]: pattern } },
        { lastName: { [Op.like]: pattern } },
        { documentNumber: { [Op.like]: pattern } },
        { email: { [Op.like]: pattern } },
        { phone: { [Op.like]: pattern } }
      ];
    }
    const result = await models.Patient.findAndCountAll({
      attributes: ["id", "city", "dateOfBirth"],
      include: patientInclude(models),
      where: {},
      order: [["id", "DESC"]],
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      distinct: true,
      subQuery: false,
      ...(Object.keys(where).length ? { include: patientInclude(models).map((entry) => ({ ...entry, where: { ...entry.where, ...where } })) } : {})
    });
    const total = Number(result.count) || 0;
    return {
      status: "ready", patients: (result.rows || []).map(presentPatient),
      search: normalizedSearch, selectedStatus, page: currentPage,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), total
    };
  } catch {
    return { status: "error", patients: [], search: normalizedSearch, selectedStatus, page: currentPage, pageCount: 1, total: 0 };
  }
}

async function getAdminPatient({ models, patientId }) {
  if (!models?.Patient?.findByPk || !models?.User) return { status: "unavailable" };
  if (!/^\\d+$/.test(String(patientId || ""))) return { status: "not_found" };
  try {
    const record = await models.Patient.findByPk(patientId, {
      attributes: ["id", "userId", "city", "dateOfBirth"],
      include: patientInclude(models)
    });
    return record ? { status: "ready", patient: presentPatient(record) } : { status: "not_found" };
  } catch {
    return { status: "error" };
  }
}

async function updateAdminPatient({ sequelize, models, patientId, input }) {
  if (!sequelize || !models?.Patient || !models?.User) return { status: "unavailable" };
  if (!/^\\d+$/.test(String(patientId || ""))) return { status: "not_found" };
  return sequelize.transaction(async (transaction) => {
    const patient = await models.Patient.findByPk(patientId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!patient) return { status: "not_found" };
    const user = await models.User.findByPk(patient.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "PATIENT") return { status: "not_found" };
    user.firstName = input.firstName;
    user.lastName = input.lastName;
    user.phone = input.phone;
    patient.city = input.city || null;
    await user.save({ transaction });
    await patient.save({ transaction });
    return { status: "saved" };
  });
}

async function changeAdminPatientStatus({ sequelize, models, patientId, actorUserId, newStatus, confirmed, now = new Date() }) {
  if (!sequelize || !models?.User || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\\d+$/.test(String(patientId || ""))) return { status: "not_found" };
  if (!["ACTIVE", "INACTIVE"].includes(newStatus)) return { status: "invalid_status" };
  if (confirmed !== "YES") return { status: "confirmation_required" };

  return sequelize.transaction(async (transaction) => {
    const patient = await models.Patient.findByPk(patientId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!patient) return { status: "not_found" };
    const user = await models.User.findByPk(patient.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "PATIENT" || !["ACTIVE", "INACTIVE"].includes(user.status)) return { status: "not_found" };
    if (user.status === newStatus) return { status: "unchanged" };
    const previousStatus = user.status;
    user.status = newStatus;
    await user.save({ transaction });
    await models.AuditLog.create({
      actorUserId,
      action: "PATIENT_STATUS_CHANGED",
      entityType: "PATIENT",
      entityId: patient.id,
      beforeData: { status: previousStatus },
      afterData: { status: newStatus },
      createdAt: now
    }, { transaction });
    return { status: "changed", previousStatus, newStatus };
  });
}

module.exports = { PAGE_SIZE, changeAdminPatientStatus, getAdminPatient, getAdminPatients, normalizeSearch, updateAdminPatient };
