const { getAdminDashboard, bogotaDayStart } = require("../src/modules/admin/services/dashboard");

describe("administrator dashboard", () => {
  test("starts the reporting day at midnight in Colombia", () => {
    expect(bogotaDayStart(new Date("2026-11-10T04:30:00.000Z")).toISOString())
      .toBe("2026-11-09T05:00:00.000Z");
  });

  test("counts patients, active doctors, today's appointments and today's attended appointments", async () => {
    const models = {
      Patient: { count: jest.fn().mockResolvedValue(1245) },
      User: { count: jest.fn().mockResolvedValue(48) },
      Appointment: {
        count: jest.fn().mockResolvedValueOnce(184).mockResolvedValueOnce(162),
        findAll: jest.fn().mockResolvedValue([
          { startsAt: new Date("2026-11-09T14:00:00.000Z") },
          { startsAt: new Date("2026-11-10T15:00:00.000Z") }
        ])
      }
    };
    const dashboard = await getAdminDashboard({ models, now: new Date("2026-11-10T15:00:00.000Z") });
    expect(dashboard.status).toBe("ready");
    expect(dashboard.counts).toEqual({
      patients: 1245, activeDoctors: 48, appointmentsToday: 184, attendedToday: 162
    });
    expect(dashboard.weeklyAppointments.slice(0, 2).map((day) => day.count)).toEqual([1, 1]);
    expect(models.User.count).toHaveBeenCalledWith({ where: { role: "DOCTOR", status: "ACTIVE" } });
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      attributes: ["startsAt"]
    }));
    expect(JSON.stringify(dashboard)).not.toMatch(/notes|observations|consultation/i);
  });

  test("shows an empty dashboard when there is no activity", async () => {
    const models = {
      Patient: { count: jest.fn().mockResolvedValue(0) },
      User: { count: jest.fn().mockResolvedValue(0) },
      Appointment: {
        count: jest.fn().mockResolvedValue(0),
        findAll: jest.fn().mockResolvedValue([])
      }
    };
    await expect(getAdminDashboard({ models })).resolves.toMatchObject({
      status: "empty", hasActivity: false,
      counts: { patients: 0, activeDoctors: 0, appointmentsToday: 0, attendedToday: 0 }
    });
  });

  test("returns a safe error state when a metric query fails", async () => {
    const models = {
      Patient: { count: jest.fn().mockRejectedValue(new Error("database unavailable")) },
      User: { count: jest.fn() },
      Appointment: { count: jest.fn(), findAll: jest.fn() }
    };
    await expect(getAdminDashboard({ models })).resolves.toMatchObject({
      status: "error", hasActivity: false
    });
  });
});
