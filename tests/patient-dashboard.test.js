const { ACTIVE_APPOINTMENT_STATUSES, getPatientDashboard } = require("../src/modules/patient/services/dashboard");

describe("patient dashboard data", () => {
  test("shows the empty state when appointments are not available yet", async () => {
    await expect(getPatientDashboard({ models: {}, userId: 12 })).resolves.toEqual({
      status: "empty", appointment: null
    });
  });

  test("finds only the next active appointment for the signed-in patient", async () => {
    const startsAt = new Date("2026-12-15T14:30:00.000Z");
    const models = {
      Patient: { findOne: jest.fn().mockResolvedValue({ id: 81, userId: 12 }) },
      Doctor: {},
      User: {},
      Specialty: {},
      Appointment: {
        findOne: jest.fn().mockResolvedValue({
          patientId: 81,
          startsAt,
          status: "CONFIRMED",
          doctor: { user: { firstName: "Carlos", lastName: "Méndez" } },
          specialty: { name: "Medicina general" }
        })
      }
    };

    const result = await getPatientDashboard({
      models, userId: 12, now: new Date("2026-12-01T00:00:00.000Z")
    });

    expect(models.Patient.findOne).toHaveBeenCalledWith({ where: { userId: 12 } });
    expect(models.Appointment.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        patientId: 81,
        status: ACTIVE_APPOINTMENT_STATUSES
      }),
      order: [["startsAt", "ASC"]]
    }));
    expect(result).toEqual({
      status: "ready",
      appointment: {
        doctorName: "Carlos Méndez",
        specialtyName: "Medicina general",
        date: expect.any(String),
        time: expect.any(String),
        status: "Confirmada"
      }
    });
  });

  test("returns the empty state when there are no upcoming appointments", async () => {
    const models = {
      Patient: { findOne: jest.fn().mockResolvedValue({ id: 81 }) },
      Appointment: { findOne: jest.fn().mockResolvedValue(null) }
    };

    await expect(getPatientDashboard({ models, userId: 12 })).resolves.toEqual({
      status: "empty", appointment: null
    });
  });

  test("returns an error state when the appointment query fails", async () => {
    const models = {
      Patient: { findOne: jest.fn().mockResolvedValue({ id: 81 }) },
      Appointment: { findOne: jest.fn().mockRejectedValue(new Error("database unavailable")) }
    };

    await expect(getPatientDashboard({ models, userId: 12 })).resolves.toEqual({
      status: "error", appointment: null
    });
  });
});
