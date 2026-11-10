const { getDoctorSchedule, todayInBogota } = require("../src/modules/doctor/services/schedule");

describe("doctor schedule", () => {
  test("uses the Colombia local date for the effective schedule", () => {
    expect(todayInBogota(new Date("2026-11-10T04:30:00.000Z"))).toBe("2026-11-09");
  });

  test("explains when schedule tables are not configured yet", async () => {
    const models = { Doctor: { findOne: jest.fn().mockResolvedValue({ id: 8 }) } };
    await expect(getDoctorSchedule({ models, userId: 77 })).resolves.toEqual({
      status: "not_configured", blocks: []
    });
  });

  test("returns only the current effective weekly blocks in weekday order", async () => {
    const models = {
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 8 }) },
      DoctorWeeklySchedule: {
        findAll: jest.fn().mockResolvedValue([{
          effectiveFrom: "2026-11-01", effectiveTo: null,
          blocks: [
            { weekday: 3, startsAt: "13:00:00", endsAt: "17:00:00" },
            { weekday: 1, startsAt: "08:00:00", endsAt: "12:00:00" }
          ]
        }])
      },
      DoctorWeeklyScheduleBlock: {}
    };
    const result = await getDoctorSchedule({ models, userId: 77, now: new Date("2026-11-10T15:00:00.000Z") });
    expect(result.status).toBe("ready");
    expect(result.blocks.map(({ weekday, weekdayLabel }) => [weekday, weekdayLabel])).toEqual([
      [1, "Lunes"], [3, "Miércoles"]
    ]);
  });
});
