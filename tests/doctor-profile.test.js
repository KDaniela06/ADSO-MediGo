const { validateDoctorProfile } = require("../src/modules/doctor/validators/profile");
const { getDoctorProfile, updateDoctorProfile } = require("../src/modules/doctor/services/profile");

describe("doctor profile", () => {
  test("accepts valid editable contact and professional details", () => {
    expect(validateDoctorProfile({
      phone: "+57 300 111 2233",
      professionalDescription: "Medicina familiar",
      profilePhotoUrl: "https://example.com/photo.jpg"
    }).isValid).toBe(true);
  });

  test("requires a valid phone and rejects unsafe photo URLs and long descriptions", () => {
    const result = validateDoctorProfile({
      phone: "abc",
      professionalDescription: "x".repeat(2001),
      profilePhotoUrl: "http://example.com/photo.jpg"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toMatchObject({
      phone: expect.any(String),
      professionalDescription: expect.any(String),
      profilePhotoUrl: expect.any(String)
    });
  });

  test("reads specialty and registration as profile data", async () => {
    const record = {
      id: 8, professionalRegistration: "MED-123",
      user: { firstName: "Carlos", phone: "+573001112233" },
      specialty: { name: "Medicina familiar" }
    };
    const models = { Doctor: { findOne: jest.fn().mockResolvedValue(record) }, User: {}, Specialty: {} };
    await expect(getDoctorProfile({ models, userId: 77 })).resolves.toBe(record);
    expect(models.Doctor.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 77 },
      include: expect.arrayContaining([
        expect.objectContaining({ as: "user" }),
        expect.objectContaining({ as: "specialty" })
      ])
    }));
  });

  test("saves only editable fields inside a transaction and keeps role unchanged", async () => {
    const user = { id: 77, role: "DOCTOR", status: "ACTIVE", phone: "", save: jest.fn() };
    const doctor = { professionalDescription: "", profilePhotoUrl: "", save: jest.fn() };
    const models = {
      User: { findByPk: jest.fn().mockResolvedValue(user) },
      Doctor: { findOne: jest.fn().mockResolvedValue(doctor) }
    };
    const sequelize = { transaction: jest.fn((callback) => callback({ LOCK: { UPDATE: "UPDATE" } })) };
    const result = await updateDoctorProfile({
      sequelize, models, userId: 77,
      input: { phone: "+573001112233", professionalDescription: "Especialista", profilePhotoUrl: "https://example.com/p.jpg" }
    });
    expect(result).toEqual({ status: "saved" });
    expect(user.phone).toBe("+573001112233");
    expect(user.role).toBe("DOCTOR");
    expect(doctor.professionalDescription).toBe("Especialista");
    expect(doctor.profilePhotoUrl).toBe("https://example.com/p.jpg");
    expect(user.save).toHaveBeenCalled();
    expect(doctor.save).toHaveBeenCalled();
  });
});
