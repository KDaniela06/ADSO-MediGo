const { Op } = require("sequelize");

const ALLOWED_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const PAGE_SIZE = 20;

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 80);
}

async function getAdminSpecialties({ models, search = "", status = "", page = 1 }) {
  const normalizedSearch = normalizeSearch(search);
  const selectedStatus = ALLOWED_STATUSES.has(status) ? status : "";
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const empty = {
    status: "unavailable", specialties: [], search: normalizedSearch,
    selectedStatus, page: currentPage, pageCount: 1, total: 0
  };
  if (!models?.Specialty?.findAndCountAll) return empty;

  try {
    const where = {};
    if (selectedStatus) where.status = selectedStatus;
    if (normalizedSearch) {
      const pattern = "%" + normalizedSearch.replace(/[\\%_]/g, "\\$&") + "%";
      where[Op.or] = [
        { name: { [Op.like]: pattern } },
        { description: { [Op.like]: pattern } }
      ];
    }
    const result = await models.Specialty.findAndCountAll({
      attributes: ["id", "name", "description", "status", "createdAt", "updatedAt"],
      where,
      order: [["name", "ASC"]],
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE
    });
    const total = Number(result.count) || 0;
    return {
      status: "ready", specialties: (result.rows || []).map(plain),
      search: normalizedSearch, selectedStatus, page: currentPage,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), total
    };
  } catch {
    return { ...empty, status: "error" };
  }
}

async function getAdminSpecialty({ models, specialtyId }) {
  if (!models?.Specialty?.findByPk) return { status: "unavailable" };
  if (!/^\d+$/.test(String(specialtyId || ""))) return { status: "not_found" };
  try {
    const specialty = await models.Specialty.findByPk(specialtyId, {
      attributes: ["id", "name", "description", "status", "createdAt", "updatedAt"]
    });
    return specialty ? { status: "ready", specialty: plain(specialty) } : { status: "not_found" };
  } catch {
    return { status: "error" };
  }
}

async function createAdminSpecialty({ sequelize, models, actorUserId, input, now = new Date() }) {
  if (!sequelize || !models?.Specialty || !models?.AuditLog) return { status: "unavailable" };
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim() || null;
  return sequelize.transaction(async (transaction) => {
    const existing = await models.Specialty.findOne({
      where: { name }, transaction, lock: transaction.LOCK.UPDATE
    });
    if (existing) return { status: "name_in_use" };
    const specialty = await models.Specialty.create({
      name, description, status: "ACTIVE"
    }, { transaction });
    await models.AuditLog.create({
      actorUserId, action: "SPECIALTY_CREATED", entityType: "SPECIALTY",
      entityId: specialty.id, beforeData: null,
      afterData: { name, description, status: "ACTIVE" }, createdAt: now
    }, { transaction });
    return { status: "created", specialty: plain(specialty) };
  });
}

async function updateAdminSpecialty({ sequelize, models, specialtyId, actorUserId, input, now = new Date() }) {
  if (!sequelize || !models?.Specialty || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\d+$/.test(String(specialtyId || ""))) return { status: "not_found" };
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim() || null;
  return sequelize.transaction(async (transaction) => {
    const specialty = await models.Specialty.findByPk(specialtyId, {
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (!specialty) return { status: "not_found" };
    const duplicate = await models.Specialty.findOne({
      where: { name, id: { [Op.ne]: specialty.id } }, transaction, lock: transaction.LOCK.UPDATE
    });
    if (duplicate) return { status: "name_in_use" };
    const beforeData = { name: specialty.name, description: specialty.description };
    const changed = beforeData.name !== name || (beforeData.description || null) !== description;
    if (!changed) return { status: "unchanged", specialty: plain(specialty) };
    specialty.name = name;
    specialty.description = description;
    await specialty.save({ transaction });
    await models.AuditLog.create({
      actorUserId, action: "SPECIALTY_UPDATED", entityType: "SPECIALTY",
      entityId: specialty.id, beforeData,
      afterData: { name, description }, createdAt: now
    }, { transaction });
    return { status: "saved", specialty: plain(specialty) };
  });
}

async function changeAdminSpecialtyStatus({ sequelize, models, specialtyId, actorUserId, status, now = new Date() }) {
  if (!sequelize || !models?.Specialty || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\d+$/.test(String(specialtyId || ""))) return { status: "not_found" };
  if (!ALLOWED_STATUSES.has(status)) return { status: "invalid_status" };
  return sequelize.transaction(async (transaction) => {
    const specialty = await models.Specialty.findByPk(specialtyId, {
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (!specialty) return { status: "not_found" };
    const beforeStatus = specialty.status;
    if (beforeStatus === status) return { status: "unchanged" };
    specialty.status = status;
    await specialty.save({ transaction });
    await models.AuditLog.create({
      actorUserId, action: status === "INACTIVE" ? "SPECIALTY_DEACTIVATED" : "SPECIALTY_ACTIVATED",
      entityType: "SPECIALTY", entityId: specialty.id,
      beforeData: { status: beforeStatus }, afterData: { status }, createdAt: now
    }, { transaction });
    return { status: "saved", specialty: plain(specialty) };
  });
}

module.exports = {
  ALLOWED_STATUSES, PAGE_SIZE, changeAdminSpecialtyStatus, createAdminSpecialty,
  getAdminSpecialties, getAdminSpecialty, normalizeSearch, updateAdminSpecialty
};
