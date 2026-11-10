const { ACTIVE_APPOINTMENT_STATUSES, getBogotaDayRange, getDoctorDashboard } = require("../src/modules/doctor/services/dashboard");

describe("doctor dashboard data", () => {
  test("calculates the current day using America/Bogota", () => {
    const range = getBogotaDayRange(new Date("2026-11-10T20:00:00.000Z"));
    expect(range.start.toISOString()).toBe("2026-11-10T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-11T05:00:00.000Z");
  });

  test("summarizes only the signed-in doctor's appointments", async () => {
    const now = new Date("2026-11-10T13:00:00.000Z");
    const records = [
      { status: "CONFIRMED", startsAt: new Date("2026-11-10T14:00:00.000Z"), patient: { user: { firstName: "Ana", lastName: "Rojas" } } },
      { status: "IN_PROGRESS", startsAt: new Date("2026-11-10T15:00:00.000Z"), patient: { user: { firstName: "Luis", lastName: "Díaz" } } },
      { status: "ATTENDED", startsAt: new Date("2026-11-10T16:00:00.000Z"), patient: { user: { firstName: "Marta", lastName: "Gil" } } }
    ];
    const models = {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 44, userId: 8 }) },
      Patient: {},
      User: {},
      Appointment: {
        findAll: jest.fn().mockResolvedValue(records),
        findOne: jest.fn().mockResolvedValue(records[0])
      }
    };

    const result = await getDoctorDashboard({ models, userId: 8, now });

    expect(models.Doctor.findOne).toHaveBeenCalledWith({ where: { userId: 8 } });
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ doctorId: 44 }),
      order: [["startsAt", "ASC"]]
    }));
    expect(models.Appointment.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ doctorId: 44, status: ACTIVE_APPOINTMENT_STATUSES })
    }));
    expect(result).toMatchObject({
      status: "ready",
      counts: { today: 3, inProgress: 1, attended: 1 },
      appointments: [
        { patientName: "Ana Rojas", status: "CONFIRMED" },
        { patientName: "Luis Díaz", status: "IN_PROGRESS" },
        { patientName: "Marta Gil", status: "ATTENDED" }
      ],
      nextAppointment: { patientName: "Ana Rojas", status: "CONFIRMED" }
    });
  });

  test("shows an empty state before appointment data is available", async () => {
    await expect(getDoctorDashboard({ models: {}, userId: 8 })).resolves.toMatchObject({
      status: "empty",
      counts: { today: 0, inProgress: 0, attended: 0 },
      appointments: [],
      nextAppointment: null
    });
  });

  test("returns an error state when the doctor's agenda cannot be loaded", async () => {
    const models = {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 44 }) },
      Appointment: { findAll: jest.fn().mockRejectedValue(new Error("database unavailable")) }
    };

    await expect(getDoctorDashboard({ models, userId: 8 })).resolves.toMatchObject({
      status: "error",
      appointments: [],
      nextAppointment: null
    });
  });
});
