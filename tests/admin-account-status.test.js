const { Op } = require("sequelize");
const { changeAdminAccountStatus, getAccountStatusPreview } = require("../src/modules/admin/services/account-status");

function setup({ role = "PATIENT", status = "ACTIVE", appointments = [] } = {}) {
  const user = {
    id: 10, firstName: "Laura", lastName: "Gómez", email: "laura@example.com",
    role, status, save: jest.fn().mockResolvedValue(undefined)
  };
  const profile = { id: 3, userId: user.id };
  const patientUser = { id: 20, firstName: "Pedro", lastName: "Paz", email: "pedro@example.com" };
  const doctorUser = { id: 30, firstName: "Ana", lastName: "Díaz", email: "ana@example.com" };
  const records = appointments.map((appointment, index) => ({
    id: index + 1, patientId: 3, doctorId: 7, status: "CONFIRMED",
    patient: { user: patientUser }, doctor: { user: doctorUser },
    save: jest.fn().mockResolvedValue(undefined),
    ...appointment
  }));
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const models = {
    Patient: { findByPk: jest.fn().mockResolvedValue(role === "PATIENT" ? profile : null) },
    Doctor: { findByPk: jest.fn().mockResolvedValue(role === "DOCTOR" ? profile : null) },
    User: { findByPk: jest.fn().mockResolvedValue(user) },
    Appointment: {
      count: jest.fn().mockResolvedValue(records.length),
      findAll: jest.fn().mockResolvedValue(records)
    },
    AuditLog: { create: jest.fn().mockResolvedValue({ id: 1 }) }
  };
  const sequelize = { transaction: jest.fn((callback) => callback(transaction)) };
  return { models, sequelize, user, records, patientUser, doctorUser };
}

describe("administrator account status", () => {
  test("previews confirmed future appointments before deactivation", async () => {
    const { models } = setup();
    const result = await getAccountStatusPreview({
      models, role: "PATIENT", accountId: "3", now: new Date("2026-11-12T12:00:00Z")
    });

    expect(result).toMatchObject({
      status: "ready",
      account: { id: 3, userId: 10, role: "PATIENT", status: "ACTIVE" },
      upcomingConfirmedAppointments: 1
    });
    expect(models.Appointment.count).toHaveBeenCalledWith({
      where: {
        patientId: 3, status: "CONFIRMED",
        startsAt: { [Op.gt]: new Date("2026-11-12T12:00:00Z") }
      }
    });
  });

  test("requires confirmation before changing account status", async () => {
    const { models, sequelize } = setup();
    const result = await changeAdminAccountStatus({
      sequelize, models, role: "PATIENT", accountId: "3", actorUserId: 99,
      newStatus: "INACTIVE", confirmed: "NO"
    });
    expect(result).toEqual({ status: "confirmation_required" });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test("deactivates a patient, cancels only confirmed future appointments and emails both parties", async () => {
    const now = new Date("2026-11-12T12:00:00Z");
    const { models, sequelize, user, records } = setup({ appointments: [{ startsAt: new Date("2026-11-14T12:00:00Z") }] });
    const sendAccountStatusNotification = jest.fn().mockResolvedValue(undefined);

    const result = await changeAdminAccountStatus({
      sequelize, models, role: "PATIENT", accountId: "3", actorUserId: 99,
      newStatus: "INACTIVE", confirmed: "YES", emailSender: { sendAccountStatusNotification }, now
    });

    expect(result).toMatchObject({ status: "changed", newStatus: "INACTIVE", cancelledAppointments: 1, notificationFailures: 0 });
    expect(user.status).toBe("INACTIVE");
    expect(records[0]).toMatchObject({ status: "CANCELLED", cancelledAt: now, cancellationReason: "ACCOUNT_DEACTIVATED" });
    expect(records[0].save).toHaveBeenCalledWith({ transaction: expect.any(Object) });
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        patientId: 3, status: "CONFIRMED",
        startsAt: { [Op.gt]: now }
      }
    }));
    expect(models.AuditLog.create).toHaveBeenCalledTimes(2);
    expect(sendAccountStatusNotification).toHaveBeenCalledTimes(2);
    expect(sendAccountStatusNotification).toHaveBeenCalledWith(expect.objectContaining({
      to: "laura@example.com", status: "INACTIVE", cancelledAppointments: 0
    }));
    expect(sendAccountStatusNotification).toHaveBeenCalledWith(expect.objectContaining({
      to: "ana@example.com", status: null, cancelledAppointments: 1
    }));
  });

  test("activates a doctor without changing appointments and reports failed email delivery", async () => {
    const { models, sequelize, user } = setup({ role: "DOCTOR", status: "INACTIVE" });
    const sendAccountStatusNotification = jest.fn().mockRejectedValue(new Error("smtp down"));
    const result = await changeAdminAccountStatus({
      sequelize, models, role: "DOCTOR", accountId: "3", actorUserId: 99,
      newStatus: "ACTIVE", confirmed: "YES", emailSender: { sendAccountStatusNotification }
    });

    expect(result).toMatchObject({ status: "changed", newStatus: "ACTIVE", cancelledAppointments: 0, notificationFailures: 1 });
    expect(user.status).toBe("ACTIVE");
    expect(models.Appointment.findAll).not.toHaveBeenCalled();
    expect(models.AuditLog.create).toHaveBeenCalledTimes(1);
  });

  test("rejects pending verification accounts and unsupported role values", async () => {
    const { models, sequelize } = setup({ status: "PENDING_VERIFICATION" });
    const pending = await changeAdminAccountStatus({
      sequelize, models, role: "PATIENT", accountId: "3", actorUserId: 99,
      newStatus: "ACTIVE", confirmed: "YES"
    });
    const unsupported = await changeAdminAccountStatus({
      sequelize, models, role: "ADMIN", accountId: "3", actorUserId: 99,
      newStatus: "INACTIVE", confirmed: "YES"
    });

    expect(pending.status).toBe("not_found");
    expect(unsupported.status).toBe("not_found");
  });
});
