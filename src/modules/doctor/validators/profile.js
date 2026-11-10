function validateDoctorProfile(input) {
  const values = {
    phone: String(input.phone || "").trim(),
    professionalDescription: String(input.professionalDescription || "").trim(),
    profilePhotoUrl: String(input.profilePhotoUrl || "").trim()
  };
  const errors = {};

  if (!values.phone) errors.phone = "Este campo es obligatorio.";
  if (values.phone && (!/^\+?[0-9\s().-]{7,30}$/.test(values.phone) || values.phone.replace(/\D/g, "").length < 7)) {
    errors.phone = "Ingresa un teléfono válido.";
  }
  if (values.professionalDescription.length > 2000) {
    errors.professionalDescription = "La descripción no puede superar 2000 caracteres.";
  }
  if (values.profilePhotoUrl) {
    try {
      const photoUrl = new URL(values.profilePhotoUrl);
      if (photoUrl.protocol !== "https:" || values.profilePhotoUrl.length > 2048) throw new Error("invalid");
    } catch {
      errors.profilePhotoUrl = "Ingresa una dirección HTTPS válida para la fotografía.";
    }
  }

  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateDoctorProfile };
