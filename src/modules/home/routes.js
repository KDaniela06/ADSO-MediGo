const { Router } = require("express");

const router = Router();

router.get("/", (request, response) => {
  response.redirect(303, "/iniciar-sesion");
});

module.exports = router;
