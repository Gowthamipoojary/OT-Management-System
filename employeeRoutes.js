const express = require("express");
const router = express.Router();
const { sql, pool, poolConnect } = require("./database");

// REAL ROUTE
router.get("/:deptId", async (req, res) => {
  try {
    await poolConnect; 
    const deptId = parseInt(req.params.deptId);
    const result = await pool.request()
      .input("deptId", sql.Int, deptId)
      .query(`
        SELECT EmpID, EmpName
        FROM Employees
        WHERE DeptID = @deptId AND IsActive = 1
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

router.get("/all/:deptId", async (req, res) => {
  try {
    await poolConnect;
    const deptId = parseInt(req.params.deptId);
    const result = await pool.request()
      .input("deptId", sql.Int, deptId)
      .query(`
        SELECT EmpID, EmpName, IsActive
        FROM Employees
        WHERE DeptID = @deptId
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    await poolConnect;

    const { empId, empName, deptId } = req.body;

    if (!empId || !empName || !deptId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await pool.request()
      .input("EmpID", sql.Int, empId)
      .input("EmpName", sql.VarChar(100), empName)
      .input("DeptID", sql.Int, deptId)
      .query(`
        INSERT INTO Employees (EmpID, EmpName, DeptID, IsActive)
        VALUES (@EmpID, @EmpName, @DeptID, 1)
      `);

    res.json({ message: "Employee added successfully" });
  } catch (err) {
    if (err.number === 2627) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});


router.put("/:empId", async (req, res) => {
  try {
    await poolConnect;

    const empId = parseInt(req.params.empId);

    await pool.request()
      .input("EmpID", sql.Int, empId)
      .query(`
        UPDATE Employees
        SET IsActive = 0
        WHERE EmpID = @EmpID
      `);

    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;