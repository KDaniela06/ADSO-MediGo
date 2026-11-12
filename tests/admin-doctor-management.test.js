const { Op } = require("sequelize");
const { validateAdminDoctor } = require("../src/modules/admin/validators/manage-doctor");
const { getAdminDoctors, invitationState, updateAdminDoctor } = require("../src/modules/admin/services/manage-doctors");

function validInput(overrides = {}) {
  return {
    firstName: "Laura",
    lastName: "Gómez",
    phone: "+57 300 123 4567",
    professionalRegistration: "reg-123",
    specialtyId: "4",
    ...overrides
  };
}

describe("administrator doctor management", () => {
  test("validates and normalizes editable account and professional fields", () => {
    const result = validateAdminDoctor(validInput());
    expect(result.isValid).toBe(true);
    expect(result.values.professionalRegistration).toBe("REG-123");
  });

  test("rejects malformed phone, invalid specialty and fields over their limits", () => {
    const result = validateAdminDoctor(validInput({
      firstName: "a".repeat(101), phone: "invalid", specialtyId: "x", professionalRegistration: "r".repeat(81)
    }));
    expect(result.errors).toEqual(expect.objectContaining({
      firstName: expect.any(String), phone: expect.any(String),
      specialtyId: expect.any(String), professionalRegistration: expect.any(String)
    }));
  });

  test("searches, filters and paginates doctors while adding invitation state", async () => {
    const doctor = {
      id: 3, userId: 12, specialtyId: 4, professionalRegistration: "REG-123",
      user: {
        id: 12, firstName: "Laura", lastName: "Gómez", documentType: "CC", documentNumber: "123",
        email: "laura@example.com", phone: "3001234567", role: "DOCTOR", status: "ACTIVE"
      },
      specialty: { id: 4, name: "Medicina general" }
    };
    const findAndCountAll = jest.fn().mockResolvedValue({ count: 1, rows: [doctor] });
    const findAll = jest.fn().mockResolvedValue([{
      userId: 12, expiresAt: new Date("2026-11-13T12:00:00Z"), usedAt: null,
      notification: { status: "SENT" }
    }]);
    const result = await getAdminDoctors({
      models: {
        Doctor: { findAndCountAll }, User: {}, Specialty: {},
        AccountToken: { findAll }, NotificationOutbox: {}
      },
      search: "laura", status: "ACTIVE", specialtyId: "4", now: new Date("2026-11-12T12:00:00Z")
    });
    expect(result).toMatchObject({
      status: "ready", total: 1, selectedStatus: "ACTIVE", selectedSpecialty: "4",
      doctors: [{ id: 3, email: "laura@example.com", invitation: { code: "PENDING", label: "Pendiente" } }]
    });
    const options = findAndCountAll.mock.calls[0][0];
    expect(options.include[0].where).toMatchObject({ role: "DOCTOR", status: "ACTIVE" });
    expect(options.where.specialtyId).toBe("4");
    expect(options.where[Op.or]).toHaveLength(6);
  });

  test("shows used and expired invitations distinctly", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    expect(invitationState({
      usedAt: now, expiresAt: new Date(now.getTime() + 1000), notification: { status: "SENT" }
    }, now).code).toBe("USED");
    expect(invitationState({
      usedAt: null, expiresAt: new Date(now.getTime() - 1000), notification: { status: "SENT" }
    }, now).code).toBe("EXPIRED");
  });

  test("asks confirmation before a specialty change and audits the confirmed update", async () => {
    const doctor = {
      id: 3, userId: 12, specialtyId: 4, professionalRegistration: "REG-OLD",
      save: jest.fn()
    };
    const user = { id: 12, role: "DOCTOR", firstName: "Laura", lastName: "Gómez", phone: "3000000000", save: jest.fn() };
    const specialty = { id: 8, status: "ACTIVE" };
    const auditCreate = jest.fn().mockResolvedValue({ id: 1 });
    const models = {
      Doctor: {
        findByPk: jest.fn().mockResolvedValue(doctor),
        findOne: jest.fn().mockResolvedValue(null)
      },
      User: { findByPk: jest.fn().mockResolvedValue(user) },
      Specialty: { findByPk: jest.fn().mockResolvedValue(specialty) },
      AuditLog: { create: auditCreate }
    };
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const sequelize = { transaction: (callback) => callback(transaction) };
    const input = {
      sequelize, models, doctorId: "3", actorUserId: 9,
      input: validInput({ specialtyId: "8" }), now: new Date("2026-11-12T12:00:00Z")
    };

    expect(await updateAdminDoctor(input)).toEqual({ status: "confirmation_required" });
    expect(doctor.save).not.toHaveBeenCalled();
    const result = await updateAdminDoctor({ ...input, confirmed: true });
    expect(result).toEqual({ status: "saved", specialtyChanged: true });
    expect(doctor).toMatchObject({ specialtyId: 8, professionalRegistration: "REG-123" });
    expect(user).toMatchObject({ firstName: "Laura", lastName: "Gómez", phone: "+57 300 123 4567" });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 9, action: "DOCTOR_SPECIALTY_CHANGED", entityType: "DOCTOR", entityId: 3,
      beforeData: expect.objectContaining({ specialtyId: 4 }),
      afterData: expect.objectContaining({ specialtyId: 8 })
    }), { transaction });
  });

  test("allows other edits when a doctor's current specialty is inactive", async () => {
    const doctor = { id: 3, userId: 12, specialtyId: 4, professionalRegistration: "REG-OLD", save: jest.fn() };
    const user = { id: 12, role: "DOCTOR", firstName: "Laura", lastName: "Gómez", phone: "3000000000", save: jest.fn() };
    const models = {
      Doctor: { findByPk: jest.fn().mockResolvedValue(doctor), findOne: jest.fn().mockResolvedValue(null) },
      User: { findByPk: jest.fn().mockResolvedValue(user) },
      Specialty: { findByPk: jest.fn().mockResolvedValue({ id: 4, status: "INACTIVE" }) },
      AuditLog: { create: jest.fn().mockResolvedValue({ id: 1 }) }
    };
    const result = await updateAdminDoctor({
      sequelize: { transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }) },
      models, doctorId: "3", actorUserId: 9, input: validInput({ specialtyId: "4" })
    });
    expect(result.status).toBe("saved");
    expect(doctor.specialtyId).toBe(4);
  });
});
