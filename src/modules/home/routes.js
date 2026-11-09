const { Router } = require("express");

const router = Router();

router.get("/", (request, response) => {
  response.render("home/views/home", { title: "Inicio" });
});

module.exports = router;
