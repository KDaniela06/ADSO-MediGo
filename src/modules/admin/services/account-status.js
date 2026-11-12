const { Op } = require("sequelize");

const ACCOUNT_ROLES = new Set(["PATIENT", "DOCTOR"]);
const ACCOUNT_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function modelForRole(models, role) {
  return role === "PATIENT" ? models?.Patient : role === "DOCTOR" ? models?.Doctor : null;
}

function accountAssociation(role) {
  return role === "PATIENT" ? "patient" : "doctor";
}

function accountIdField(role) {
  return role === "PATIENT" ? "patientId" : "doctorId";
}

function appointmentIncludes(models) {
  return [
    {
      model: models.Patient,
      as: "patient",
      include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "lastName", "email", "role"] }]
    },
    {
      model: models.Doctor,
      as: "doctor",
      include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "lastName", "email", "role"] }]
    }
  ];
}

function notificationRecipients(user, role, appointments, accountStatus) {
  const recipients = new Map();
  const add = (record, messageCount, isTarget = false) => {
    const account = plain(record);
    if (!account?.email) return;
    const key = String(account.id);
    const existing = recipients.get(key);
    recipients.set(key, {
      email: account.email,
      firstName: account.firstName || "",
      status: isTarget ? accountStatus : null,
      cancelledAppointments: (existing?.cancelledAppointments || 0) + messageCount
    });
  };

  add(user, 0, true);
  for (const appointmentRecord of appointments) {
    const appointment = plain(appointmentRecord);
    const patientUser = plain(plain(appointment.patient)?.user);
    const doctorUser = plain(plain(appointment.doctor)?.user);
    const counterpart = role === "PATIENT" ? doctorUser : patientUser;
    add(counterpart, 1);
  }
  return [...recipients.values()];
}

async function getAccountStatusPreview({ models, role, accountId, now = new Date() }) {
  if (!ACCOUNT_ROLES.has(role)) return { status: "not_found" };
  const Model = modelForRole(models, role);
  if (!Model?.findByPk || !models?.User || !models?.Appointment?.count) return { status: "unavailable" };
  if (!/^\d+$/.test(String(accountId || ""))) return { status: "not_found" };
  try {
    const record = await Model.findByPk(accountId, {
      attributes: ["id", "userId"],
      include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "lastName", "role", "status"], where: { role } }]
    });
    if (!record) return { status: "not_found" };
    const account = plain(record);
    const user = plain(account.user);
    if (!user || !ACCOUNT_STATUSES.has(user.status)) return { status: "not_found" };
    const upcomingConfirmedAppointments = user.status === "ACTIVE"
      ? await models.Appointment.count({
        where: {
          [accountIdField(role)]: account.id,
          status: "CONFIRMED",
          startsAt: { [Op.gt]: now }
        }
      })
      : 0;
    return {
      status: "ready",
      account: {
        id: account.id,
        userId: user.id,
        role,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status
      },
      upcomingConfirmedAppointments
    };
  } catch {
    return { status: "error" };
  }
}

async function changeAdminAccountStatus({
  sequelize, models, role, accountId, actorUserId, newStatus, confirmed, emailSender, now = new Date()
}) {
  if (!ACCOUNT_ROLES.has(role)) return { status: "not_found" };
  const Model = modelForRole(models, role);
  if (!sequelize || !Model || !models?.User || !models?.Appointment || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\d+$/.test(String(accountId || ""))) return { status: "not_found" };
  if (!ACCOUNT_STATUSES.has(newStatus)) return { status: "invalid_status" };
  if (confirmed !== "YES") return { status: "confirmation_required" };

  const result = await sequelize.transaction(async (transaction) => {
    const profile = await Model.findByPk(accountId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!profile) return { status: "not_found" };
    const user = await models.User.findByPk(profile.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== role || !ACCOUNT_STATUSES.has(user.status)) return { status: "not_found" };
    if (user.status === newStatus) return { status: "unchanged" };

    const previousStatus = user.status;
    let appointments = [];
    if (newStatus === "INACTIVE") {
      appointments = await models.Appointment.findAll({
        where: {
          [accountIdField(role)]: profile.id,
          status: "CONFIRMED",
          startsAt: { [Op.gt]: now }
        },
        attributes: ["id", "patientId", "doctorId", "startsAt", "endsAt", "status"],
        include: appointmentIncludes(models),
        order: [["startsAt", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      for (const appointment of appointments) {
        appointment.status = "CANCELLED";
        appointment.cancelledAt = now;
        appointment.cancellationReason = "ACCOUNT_DEACTIVATED";
        await appointment.save({ transaction });
        await models.AuditLog.create({
          actorUserId,
          action: "APPOINTMENT_CANCELLED_ACCOUNT_DEACTIVATION",
          entityType: "APPOINTMENT",
          entityId: appointment.id,
          beforeData: { status: "CONFIRMED" },
          afterData: { status: "CANCELLED", cancellationReason: "ACCOUNT_DEACTIVATED", accountRole: role },
          createdAt: now
        }, { transaction });
      }
    }

    user.status = newStatus;
    await user.save({ transaction });
    await models.AuditLog.create({
      actorUserId,
      action: "ACCOUNT_STATUS_CHANGED",
      entityType: role,
      entityId: profile.id,
      beforeData: { status: previousStatus },
      afterData: { status: newStatus, cancelledAppointments: appointments.length },
      createdAt: now
    }, { transaction });

    const recipients = newStatus === "INACTIVE"
      ? notificationRecipients(user, role, appointments, newStatus)
      : notificationRecipients(user, role, [], newStatus);
    return { status: "changed", previousStatus, newStatus, cancelledAppointments: appointments.length, recipients };
  });

  if (result.status !== "changed") return result;
  let notificationFailures = 0;
  if (typeof emailSender?.sendAccountStatusNotification !== "function") {
    notificationFailures = result.recipients.length;
  } else {
    for (const recipient of result.recipients) {
      try {
        await emailSender.sendAccountStatusNotification({
          to: recipient.email,
          firstName: recipient.firstName,
          role,
          status: recipient.status,
          changedAccountStatus: newStatus,
          impactedRole: role,
          cancelledAppointments: recipient.cancelledAppointments
        });
      } catch {
        notificationFailures += 1;
      }
    }
  }
  return { ...result, recipients: undefined, notificationFailures };
}

module.exports = { ACCOUNT_ROLES, ACCOUNT_STATUSES, changeAdminAccountStatus, getAccountStatusPreview };
