const { Op } = require("sequelize");
const { changeAdminPatientStatus, getAdminPatients, normalizeSearch, updateAdminPatient } = require("../src/modules/admin/services/patients");
const { validateAdminPatient } = require("../src/modules/admin/validators/patient");

describe("administrator patient management", () => {
  test("normalizes and validates administrative edits only", () => {
    expect(normalizeSearch("  Ana   ")).toBe("Ana");
    expect(validateAdminPatient({ firstName: "Ana", lastName: "Paz", phone: "+57 300 111 2233", city: "Cali" }).isValid).toBe(true);
    expect(validateAdminPatient({ firstName: "", lastName: "Paz", phone: "abc", city: "x".repeat(101) }).errors)
      .toEqual(expect.objectContaining({ firstName: expect.any(String), phone: expect.any(String), city: expect.any(String) }));
  });

  test("searches and filters only patient accounts without loading clinical data", async () => {
    const rows = [{ id: 3, city: "Cali", dateOfBirth: "1995-04-02", user: {
      id: 7, firstName: "Ana", lastName: "Paz", documentType: "CC",
      documentNumber: "123", email: "ana@example.com", phone: "3001112233", status: "ACTIVE",
      notes: "must not be selected"
    } }];
    const findAndCountAll = jest.fn().mockResolvedValue({ count: 1, rows });
    const result = await getAdminPatients({ models: { Patient: { findAndCountAll }, User: {} }, search: "ana", status: "ACTIVE" });
    expect(result).toMatchObject({ status: "ready", total: 1, selectedStatus: "ACTIVE" });
    expect(result.patients[0]).not.toHaveProperty("notes");
    const options = findAndCountAll.mock.calls[0][0];
    expect(options.include[0].where).toEqual(expect.objectContaining({ role: "PATIENT", status: "ACTIVE" }));
    expect(options.include[0].where[Op.or]).toHaveLength(5);
    expect(options.include[0].attributes).not.toContain("notes");
  });

  test("updates allowed contact fields and does not update protected fields", async () => {
    const user = { id: 7, role: "PATIENT", firstName: "Old", save: jest.fn() };
    const patient = { id: 3, userId: 7, city: "Bogota", save: jest.fn() };
    const models = {
      Patient: { findByPk: jest.fn().mockResolvedValue(patient) },
      User: { findByPk: jest.fn().mockResolvedValue(user) }
    };
    const sequelize = { transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }) };
    const result = await updateAdminPatient({
      sequelize, models, patientId: "3",
      input: { firstName: "Ana", lastName: "Paz", phone: "3001112233", city: "Cali", email: "new@example.com", role: "ADMIN" }
    });
    expect(result.status).toBe("saved");
    expect(user).toMatchObject({ firstName: "Ana", lastName: "Paz", phone: "3001112233", role: "PATIENT" });
    expect(user.email).toBeUndefined();
    expect(patient.city).toBe("Cali");
  });

  test("requires confirmation and records status changes in the same transaction", async () => {
    const user = { id: 7, role: "PATIENT", status: "ACTIVE", save: jest.fn() };
    const audit = { create: jest.fn().mockResolvedValue({ id: 1 }) };
    const models = {
      Patient: { findByPk: jest.fn().mockResolvedValue({ id: 3, userId: 7 }) },
      User: { findByPk: jest.fn().mockResolvedValue(user) },
      AuditLog: audit
    };
    const sequelize = { transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }) };
    const input = { sequelize, models, patientId: "3", actorUserId: 9, newStatus: "INACTIVE" };
    expect(await changeAdminPatientStatus(input)).toEqual({ status: "confirmation_required" });
    const result = await changeAdminPatientStatus({ ...input, confirmed: "YES", now: new Date("2026-11-11T12:00:00Z") });
    expect(result).toMatchObject({ status: "changed", previousStatus: "ACTIVE", newStatus: "INACTIVE" });
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 9, action: "PATIENT_STATUS_CHANGED", entityType: "PATIENT", entityId: 3,
      beforeData: { status: "ACTIVE" }, afterData: { status: "INACTIVE" }
    }), expect.objectContaining({ transaction: expect.any(Object) }));
  });
});
