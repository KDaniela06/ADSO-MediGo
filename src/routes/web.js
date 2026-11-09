const { Router } = require("express");

const router = Router();

router.get("/", (request, response) => {
  response.render("pages/home", { title: "Inicio" });
});

module.exports = router;

