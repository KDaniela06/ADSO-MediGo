function clearSessionAndRedirect(request, response) {
  if (!request.session) return response.redirect(303, "/iniciar-sesion");
  return request.session.destroy(() => {
    response.clearCookie("medigo.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });
    response.redirect(303, "/iniciar-sesion");
  });
}

function requireAuthenticatedUser({ models }) {
  return async (request, response, next) => {
    if (!request.session?.userId) {
      return response.redirect(303, "/iniciar-sesion");
    }
    if (!models?.User) {
      return response.status(503).send("El acceso no está disponible en este momento.");
    }

    try {
      const user = await models.User.findByPk(request.session.userId, {
        attributes: ["id", "firstName", "lastName", "email", "role", "status", "emailVerifiedAt"]
      });
      if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
        return clearSessionAndRedirect(request, response);
      }

      request.currentUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      };
      response.locals.currentUser = request.currentUser;
      return next();
    } catch {
      return response.status(503).send("El acceso no está disponible en este momento.");
    }
  };
}

function requireRole(role) {
  return (request, response, next) => {
    if (request.currentUser?.role !== role) {
      return response.status(403).render("auth/views/access-denied", {
        title: "Acceso restringido",
        message: "No tienes permiso para consultar esta página."
      });
    }
    return next();
  };
}

module.exports = { requireAuthenticatedUser, requireRole };
