const { Op } = require("sequelize");
const { validateSpecialty } = require("../src/modules/admin/validators/specialty");
const {
  changeAdminSpecialtyStatus, createAdminSpecialty, getAdminSpecialties,
  getAdminSpecialty, updateAdminSpecialty
} = require("../src/modules/admin/services/specialties");

function transactionHarness() {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  return { transaction, sequelize: { transaction: (callback) => callback(transaction) } };
}

describe("administrator specialty management", () => {
  test("validates required name and optional description lengths", () => {
    expect(validateSpecialty({ name: "  Pediatría ", description: "  Atención infantil " })).toMatchObject({
      values: { name: "Pediatría", description: "Atención infantil" }, isValid: true
    });
    const invalid = validateSpecialty({ name: " ", description: "d".repeat(501) });
    expect(invalid.errors).toMatchObject({
      name: expect.any(String), description: expect.any(String)
    });
  });

  test("searches and filters the specialties catalog", async () => {
    const row = { id: 2, name: "Pediatría", status: "ACTIVE" };
    const findAndCountAll = jest.fn().mockResolvedValue({ count: 1, rows: [row] });
    const result = await getAdminSpecialties({
      models: { Specialty: { findAndCountAll } }, search: " pedi ", status: "ACTIVE", page: "2"
    });
    expect(result).toMatchObject({
      status: "ready", total: 1, search: "pedi", selectedStatus: "ACTIVE",
      page: 2, specialties: [row]
    });
    expect(findAndCountAll.mock.calls[0][0].where).toMatchObject({
      status: "ACTIVE", [Op.or]: expect.any(Array)
    });
  });

  test("creates an active specialty and records the administrator action", async () => {
    const { sequelize, transaction } = transactionHarness();
    const specialty = { id: 7, name: "Pediatría", description: null, status: "ACTIVE" };
    const findOne = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue(specialty);
    const audit = jest.fn().mockResolvedValue({});
    const result = await createAdminSpecialty({
      sequelize, models: { Specialty: { findOne, create }, AuditLog: { create: audit } },
      actorUserId: 11, input: { name: " Pediatría ", description: "" }
    });
    expect(result.status).toBe("created");
    expect(create).toHaveBeenCalledWith(
      { name: "Pediatría", description: null, status: "ACTIVE" }, { transaction }
    );
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 11, action: "SPECIALTY_CREATED", entityType: "SPECIALTY", entityId: 7
    }), { transaction });
  });

  test("rejects a duplicate name and validates specialty identifiers", async () => {
    const { sequelize } = transactionHarness();
    const create = jest.fn();
    const result = await createAdminSpecialty({
      sequelize, models: { Specialty: { findOne: jest.fn().mockResolvedValue({ id: 1 }), create }, AuditLog: { create: jest.fn() } },
      actorUserId: 11, input: { name: "Pediatría" }
    });
    expect(result.status).toBe("name_in_use");
    expect(create).not.toHaveBeenCalled();
    expect((await getAdminSpecialty({ models: { Specialty: { findByPk: jest.fn() } }, specialtyId: "x" })).status).toBe("not_found");
    expect((await getAdminSpecialty({
      models: { Specialty: { findByPk: jest.fn().mockResolvedValue({ id: 4, name: "Medicina" }) } },
      specialtyId: "4"
    })).status).toBe("ready");
  });

  test("updates specialty details and audits only the change", async () => {
    const { sequelize, transaction } = transactionHarness();
    const specialty = { id: 4, name: "Medicina", description: null, save: jest.fn() };
    const audit = jest.fn().mockResolvedValue({});
    const result = await updateAdminSpecialty({
      sequelize, models: {
        Specialty: { findByPk: jest.fn().mockResolvedValue(specialty), findOne: jest.fn().mockResolvedValue(null) },
        AuditLog: { create: audit }
      },
      specialtyId: "4", actorUserId: 11, input: { name: "Medicina general", description: "Primera atención" }
    });
    expect(result.status).toBe("saved");
    expect(specialty.save).toHaveBeenCalledWith({ transaction });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "SPECIALTY_UPDATED",
      beforeData: { name: "Medicina", description: null },
      afterData: { name: "Medicina general", description: "Primera atención" }
    }), { transaction });
  });

  test("deactivates a specialty without changing existing appointments", async () => {
    const { sequelize, transaction } = transactionHarness();
    const specialty = { id: 4, status: "ACTIVE", save: jest.fn() };
    const audit = jest.fn().mockResolvedValue({});
    const result = await changeAdminSpecialtyStatus({
      sequelize, models: { Specialty: { findByPk: jest.fn().mockResolvedValue(specialty) }, AuditLog: { create: audit } },
      specialtyId: "4", actorUserId: 11, status: "INACTIVE"
    });
    expect(result.status).toBe("saved");
    expect(specialty.status).toBe("INACTIVE");
    expect(specialty.save).toHaveBeenCalledWith({ transaction });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "SPECIALTY_DEACTIVATED", beforeData: { status: "ACTIVE" }, afterData: { status: "INACTIVE" }
    }), { transaction });
  });
});
