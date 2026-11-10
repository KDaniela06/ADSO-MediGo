const { getDoctorPatient, getDoctorPatients, normalizeSearch } = require("../src/modules/doctor/services/patients");

describe("doctor patients", () => {
  const appointments = [
    {
      id: 1, patientId: 51, startsAt: new Date("2026-11-08T15:00:00.000Z"), status: "ATTENDED",
      patient: { id: 51, city: "Bogotá", user: { firstName: "María", lastName: "López", documentType: "CC", documentNumber: "111", phone: "+573001112233" } }
    },
    {
      id: 2, patientId: 51, startsAt: new Date("2026-11-09T15:00:00.000Z"), status: "CONFIRMED",
      patient: { id: 51, city: "Bogotá", user: { firstName: "María", lastName: "López", documentType: "CC", documentNumber: "111", phone: "+573001112233" } }
    },
    {
      id: 3, patientId: 52, startsAt: new Date("2026-11-07T15:00:00.000Z"), status: "CANCELLED",
      patient: { id: 52, city: "Cali", user: { firstName: "Andrés", lastName: "Pérez", documentType: "CE", documentNumber: "222", phone: "+573009998877" } }
    }
  ];

  function setup() {
    return {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 8 }) },
      Patient: {},
      User: {},
      Appointment: { findAll: jest.fn().mockResolvedValue(appointments) }
    };
  }

  test("normalizes accents and case when searching", () => {
    expect(normalizeSearch("  MARIA LOPEZ ")).toBe("maria lopez");
  });

  test("lists unique patients who have appointments with the signed-in doctor", async () => {
    const models = setup();
    const result = await getDoctorPatients({ models, userId: 77 });

    expect(models.Doctor.findOne).toHaveBeenCalledWith({
      where: { userId: 77 }, attributes: ["id"]
    });
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { doctorId: 8 },
      attributes: ["id", "patientId", "startsAt", "status"]
    }));
    expect(result.status).toBe("ready");
    expect(result.patients).toHaveLength(2);
    expect(result.patients[0]).toMatchObject({
      id: 52, name: "Andrés Pérez", documentNumber: "222", appointmentCount: 1
    });
    expect(result.patients[1]).toMatchObject({
      id: 51, name: "María López", documentNumber: "111", appointmentCount: 2
    });
    expect(result.patients[1].lastAppointment).toMatchObject({ status: "CONFIRMED" });
    expect(JSON.stringify(result)).not.toContain("history");
    expect(JSON.stringify(result)).not.toContain("notes");
  });

  test("filters by patient search fields", async () => {
    const result = await getDoctorPatients({
      models: setup(), userId: 77, search: "maria lopez"
    });
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0].name).toBe("María López");
  });

  test("returns a patient detail only after finding the doctor-patient appointment association", async () => {
    const models = setup();
    models.Appointment.findAll.mockResolvedValue([appointments[0], appointments[1]]);
    const result = await getDoctorPatient({ models, userId: 77, patientId: 51 });

    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { doctorId: 8 },
      include: expect.arrayContaining([
        expect.objectContaining({ where: { id: 51 }, required: true })
      ])
    }));
    expect(result).toMatchObject({
      status: "ready",
      patient: { id: 51, name: "María López", appointmentCount: 2 }
    });
  });

  test("does not find a patient without an assigned appointment", async () => {
    const models = setup();
    models.Appointment.findAll.mockResolvedValue([]);
    await expect(getDoctorPatient({ models, userId: 77, patientId: 999 })).resolves.toEqual({
      status: "not_found"
    });
  });

  test("returns a safe error when the database query fails", async () => {
    const models = setup();
    models.Appointment.findAll.mockRejectedValue(new Error("database unavailable"));
    await expect(getDoctorPatients({ models, userId: 77 })).resolves.toMatchObject({
      status: "error", patients: []
    });
  });
});
