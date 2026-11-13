const path = require("node:path");
const pug = require("pug");
const { validateWeeklySchedule } = require("../src/modules/admin/validators/weekly-schedule");
const {
  previewDoctorScheduleChanges, saveDoctorWeeklySchedule, scheduleBlockCoversAppointment
} = require("../src/modules/admin/services/weekly-schedules");

function transactionHarness() {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  return { transaction, sequelize: { transaction: (callback) => callback(transaction) } };
}

function appointment(id, startsAt, endsAt) {
  return {
    id, startsAt: new Date(startsAt), endsAt: new Date(endsAt), status: "CONFIRMED",
    cancelledAt: null, cancellationReason: null,
    patient: { user: { firstName: "Laura", lastName: "Gómez", email: "laura@example.com" } },
    save: jest.fn().mockResolvedValue(undefined)
  };
}

describe("administrator weekly schedules", () => {
  test("compiles the administrator schedule screens", () => {
    for (const view of ["weekly-schedules.pug", "weekly-schedule-confirmation.pug"]) {
      expect(() => pug.compileFile(path.join(__dirname, "../src/modules/admin/views", view))).not.toThrow();
    }
  });

  test("validates half-hour blocks and rejects overlaps and midnight crossing", () => {
    const valid = validateWeeklySchedule({
      weekday: ["1", "1"], startsAt: ["09:00", "10:00"], endsAt: ["09:30", "11:00"]
    });
    expect(valid.isValid).toBe(true);
    expect(valid.values.blocks).toHaveLength(2);

    const overlap = validateWeeklySchedule({
      weekday: ["1", "1"], startsAt: ["09:00", "09:30"], endsAt: ["10:00", "11:00"]
    });
    expect(overlap.errors.blocks).toMatch(/superponerse/);

    const invalid = validateWeeklySchedule({
      weekday: "1", startsAt: "23:30", endsAt: "00:30"
    });
    expect(invalid.errors.blocks).toMatch(/medianoche/);
  });

  test("requires time boundaries on 30-minute marks and keeps invalid form values", () => {
    const result = validateWeeklySchedule({
      weekday: "2", startsAt: "09:15", endsAt: "10:00"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.blocks).toMatch(/30 minutos/);
    expect(result.values.blocks).toEqual([{ weekday: "2", startsAt: "09:15", endsAt: "10:00" }]);
  });

  test("checks appointments against the doctor's local weekly hours", () => {
    const visit = appointment(1, "2026-11-16T14:00:00Z", "2026-11-16T14:30:00Z");
    expect(scheduleBlockCoversAppointment(visit, [
      { weekday: 1, startsAt: "09:00", endsAt: "10:00" }
    ])).toBe(true);
    expect(scheduleBlockCoversAppointment(visit, [
      { weekday: 1, startsAt: "10:00", endsAt: "11:00" }
    ])).toBe(false);
  });

  test("previews future confirmed appointments that would fall outside the new hours", async () => {
    const inRange = appointment(1, "2026-11-16T14:00:00Z", "2026-11-16T14:30:00Z");
    const outside = appointment(2, "2026-11-16T16:00:00Z", "2026-11-16T16:30:00Z");
    const result = await previewDoctorScheduleChanges({
      models: {
        Doctor: { findByPk: jest.fn().mockResolvedValue({ id: 5 }) },
        Appointment: { findAll: jest.fn().mockResolvedValue([inRange, outside]) },
        Patient: {}, User: {}
      },
      doctorId: "5",
      blocks: [{ weekday: 1, startsAt: "09:00", endsAt: "10:00" }],
      now: new Date("2026-11-12T12:00:00Z")
    });
    expect(result.status).toBe("ready");
    expect(result.appointments.map((item) => item.id)).toEqual([2]);
  });

  test("requires a fresh confirmation if the affected appointment list changed", async () => {
    const { sequelize } = transactionHarness();
    const findByPk = jest.fn().mockResolvedValue({ id: 5 });
    const createSchedule = jest.fn();
    const affected = appointment(2, "2026-11-16T16:00:00Z", "2026-11-16T16:30:00Z");
    const result = await saveDoctorWeeklySchedule({
      sequelize,
      models: {
        Doctor: { findByPk },
        DoctorWeeklySchedule: { findOne: jest.fn().mockResolvedValue(null), create: createSchedule },
        DoctorWeeklyScheduleBlock: { bulkCreate: jest.fn() },
        Appointment: { findAll: jest.fn().mockResolvedValue([affected]) },
        AuditLog: { create: jest.fn() }, Patient: {}, User: {}
      },
      doctorId: "5", actorUserId: 9,
      blocks: [{ weekday: 1, startsAt: "09:00", endsAt: "10:00" }],
      confirmed: "YES", confirmedAppointmentIds: [],
      now: new Date("2026-11-12T12:00:00Z")
    });
    expect(result.status).toBe("preview_changed");
    expect(createSchedule).not.toHaveBeenCalled();
    expect(affected.save).not.toHaveBeenCalled();
  });

  test("saves a version, cancels affected appointments and sends notices in one confirmed action", async () => {
    const { sequelize, transaction } = transactionHarness();
    const doctor = { id: 5 };
    const affected = appointment(2, "2026-11-16T16:00:00Z", "2026-11-16T16:30:00Z");
    const createSchedule = jest.fn().mockResolvedValue({ id: 12 });
    const bulkCreate = jest.fn().mockResolvedValue([]);
    const audit = jest.fn().mockResolvedValue({});
    const sendNotice = jest.fn().mockResolvedValue(undefined);
    const result = await saveDoctorWeeklySchedule({
      sequelize,
      models: {
        Doctor: { findByPk: jest.fn().mockResolvedValue(doctor) },
        DoctorWeeklySchedule: { findOne: jest.fn().mockResolvedValue(null), create: createSchedule },
        DoctorWeeklyScheduleBlock: { bulkCreate },
        Appointment: { findAll: jest.fn().mockResolvedValue([affected]) },
        AuditLog: { create: audit }, Patient: {}, User: {}
      },
      doctorId: "5", actorUserId: 9,
      blocks: [{ weekday: 1, startsAt: "09:00", endsAt: "10:00" }],
      confirmed: "YES", confirmedAppointmentIds: ["2"],
      emailSender: { sendAppointmentCancellationNotification: sendNotice },
      now: new Date("2026-11-12T12:00:00Z")
    });
    expect(result).toMatchObject({ status: "saved", cancelled: 1, failedNotifications: 0 });
    expect(createSchedule).toHaveBeenCalledWith(expect.objectContaining({
      doctorId: 5, status: "ACTIVE", effectiveTo: null
    }), { transaction });
    expect(bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ scheduleId: 12, weekday: 1, startsAt: "09:00:00", endsAt: "10:00:00" })
    ], { transaction });
    expect(affected).toMatchObject({ status: "CANCELLED", cancellationReason: "Horario médico actualizado" });
    expect(affected.save).toHaveBeenCalledWith({ transaction });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(sendNotice).toHaveBeenCalledWith(expect.objectContaining({
      to: "laura@example.com", appointmentDate: expect.any(String), appointmentTime: expect.any(String)
    }));
  });
});
