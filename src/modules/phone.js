function isValidPhone(value) {
  const phone = String(value || "").trim();
  const digits = phone.replace(/\D/g, "");
  const isLocalNumber = /^\d{7,10}$/.test(phone);
  const isColombianInternationalNumber = /^\+57[\s().-]?[0-9\s().-]+$/.test(phone)
    && digits.startsWith("57")
    && digits.length === 12;

  return isLocalNumber || isColombianInternationalNumber;
}

module.exports = { isValidPhone };
