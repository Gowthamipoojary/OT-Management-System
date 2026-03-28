const express = require("express");
const router = express.Router();
const { sql, pool, poolConnect } = require("./database");
// POST /login
router.post("/", async (req, res) => {
  const { emp_name, password } = req.body;
  try {
    await poolConnect;
    // 🔑 UPDATE 1: JOIN WITH Departments
    const result = await pool.request()
      .input("emp_name", sql.VarChar, emp_name)
      .input("password", sql.VarChar, password)
      .query(`
        SELECT 
          l.emp_id,
          l.emp_name,
          l.Department,
          d.DeptID,
          d.DeptName
        FROM login l
        JOIN Departments d
          ON l.Department = d.DeptName
        WHERE l.emp_name = @emp_name
          AND l.password = @password
      `);
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      // 🔑 UPDATE 2: STORE FULL USER INFO IN SESSION
      req.session.isLoggedIn = true;
      req.session.user = {
        empId: user.emp_id,
        empName: user.emp_name,
        department: user.Department, // text
        deptId: user.DeptID          
      };
      res.redirect("/index");
    } else {
        res.redirect("/login.html?error=1");
      }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
router.get("/logged-user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }
  res.json({
    empName: req.session.user.empName,
    department: req.session.user.department, 
    deptId: req.session.user.deptId         
  });
});
module.exports = router;