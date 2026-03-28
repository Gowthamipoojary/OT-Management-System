const express = require("express");
const router = express.Router();
const { pool } = require("./database");

router.get("/", async (req, res) => {
  try {
    const result = await pool.request().query(
      "SELECT DeptID, DeptName FROM Departments"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;