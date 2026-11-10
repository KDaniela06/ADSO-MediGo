const {
  getDoctorAppointment,
  getDoctorAppointments,
  parseBogotaDate,
  presentAppointment
} = require("../src/modules/doctor/services/appointments");
const { validateAppointmentFilters } = require("../src/modules/doctor/validators/appointments");

describe("doctor appointment queries", () => {
  const now = new Date("2026-11-10T15:00:00.000Z");

  function record(overrides = {}) {
    return {
      id: 81,
      startsAt: new Date("2026-11-10T15:00:00.000Z"),
      endsAt: new Date("2026-11-10T15:30:00.000Z"),
      status: "CONFIRMED",
      patient: {
        user: {
          firstName: "Ana", lastName: "Rojas",
          documentType: "CC", documentNumber: "123456",
          phone: "+573001112233"
        }
      },
      specialty: { name: "Medicina general" },
      ...overrides
    };
  }

  test("validates dates and status filters", () => {
    expect(validateAppointmentFilters({ date: "2026-11-10", status: "CONFIRMED" })).toMatchObject({
      isValid: true,
      values: { date: "2026-11-10", status: "CONFIRMED" }
    });
    expect(validateAppointmentFilters({ date: "2026-02-30", status: "UNKNOWN" })).toMatchObject({
      isValid: false,
      errors: { date: expect.any(String), status: expect.any(String) }
    });
    expect(parseBogotaDate("2026-11-10")).toBeInstanceOf(Date);
    expect(parseBogotaDate("10-11-2026")).toBeUndefined();
  });

  test("lists only the logged-in doctor's appointments with the requested filters", async () => {
    const models = {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 9, userId: 44 }) },
      Patient: {},
      User: {},
      Specialty: {},
      Appointment: { findAll: jest.fn().mockResolvedValue([record()]) }
    };

    const result = await getDoctorAppointments({
      models,
      userId: 44,
      filters: { date: "2026-11-10", status: "CONFIRMED" },
      now
    });

    expect(models.Doctor.findOne).toHaveBeenCalledWith({ where: { userId: 44 } });
    const query = models.Appointment.findAll.mock.calls[0][0];
    expect(query.where).toMatchObject({ doctorId: 9, status: "CONFIRMED" });
    expect(query.where.startsAt[Object.getOwnPropertySymbols(query.where.startsAt)[0]]).toBeInstanceOf(Date);
    expect(query.order).toEqual([["startsAt", "ASC"]]);
    expect(result).toMatchObject({
      status: "ready",
      appointments: [{
        id: 81, patientName: "Ana Rojas", specialty: "Medicina general",
        documentNumber: "123456", phone: "+573001112233", status: "CONFIRMED", canStart: true
      }]
    });
  });

  test("does not enable starting an appointment before its scheduled time", () => {
    const appointment = presentAppointment(record(), new Date("2026-11-10T14:59:59.999Z"));
    expect(appointment.canStart).toBe(false);
  });

  test("returns not found for an appointment that is not assigned to the doctor", async () => {
    const models = {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 9 }) },
      Appointment: { findOne: jest.fn().mockResolvedValue(null) }
    };

    await expect(getDoctorAppointment({
      models, userId: 44, appointmentId: 999, now
    })).resolves.toEqual({ status: "not_found" });
    expect(models.Appointment.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 999, doctorId: 9 }
    }));
  });

  test("returns an error state if appointment data cannot be loaded", async () => {
    const models = {
      Doctor: { findOne: jest.fn().mockRejectedValue(new Error("database unavailable")) },
      Appointment: { findAll: jest.fn() }
    };

    await expect(getDoctorAppointments({ models, userId: 44, now })).resolves.toMatchObject({
      status: "error", appointments: []
    });
  });
});
