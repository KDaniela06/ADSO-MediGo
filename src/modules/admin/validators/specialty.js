function validateSpecialty(input = {}) {
  const values = {
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim()
  };
  const errors = {};
  if (!values.name) errors.name = "El nombre es obligatorio.";
  if (values.name.length > 100) errors.name = "El nombre no puede superar 100 caracteres.";
  if (values.description.length > 500) errors.description = "La descripción no puede superar 500 caracteres.";
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateSpecialty };
