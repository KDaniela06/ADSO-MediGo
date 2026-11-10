function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

async function getDoctorProfile({ models, userId }) {
  const doctorRecord = await models.Doctor.findOne({
    where: { userId },
    attributes: ["id", "specialtyId", "professionalRegistration", "professionalDescription", "profilePhotoUrl"],
    include: [
      { model: models.User, as: "user", attributes: ["firstName", "lastName", "email", "phone"] },
      ...(models.Specialty ? [{ model: models.Specialty, as: "specialty", attributes: ["name"] }] : [])
    ]
  });
  return plain(doctorRecord);
}

async function updateDoctorProfile({ sequelize, models, userId, input }) {
  return sequelize.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const doctor = await models.Doctor.findOne({
      where: { userId }, transaction, lock: transaction.LOCK.UPDATE
    });
    if (!user || user.role !== "DOCTOR" || user.status !== "ACTIVE" || !doctor) {
      return { status: "not_found" };
    }

    user.phone = input.phone;
    doctor.professionalDescription = input.professionalDescription || null;
    doctor.profilePhotoUrl = input.profilePhotoUrl || null;
    await user.save({ transaction });
    await doctor.save({ transaction });
    return { status: "saved" };
  });
}

module.exports = { getDoctorProfile, updateDoctorProfile };
