const express = require("express");
const router = express.Router();
const { sql, pool, poolConnect } = require("./database");
const ExcelJS = require("exceljs");
/* =========================
   INSERT OT RECORD
========================= */
router.post("/", async (req, res) => {
  try {
    await poolConnect;
    const {
      empId,
      otDate,
      shift,
      otHours,
      givenBy,
      reason
    } = req.body;
    // 1️⃣ Basic validation
    if (!empId || !otDate || !otHours) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    // 2️⃣ CHECK MONTHLY OT LIMIT (BEFORE INSERT)
    const limitCheck = await pool.request()
      .input("EmpID", sql.Int, empId)
      .input("OTDate", sql.Date, otDate)
      .query(`
        SELECT 
          ISNULL(SUM(OTHours), 0) AS TotalHours
        FROM OT_Records
        WHERE EmpID = @EmpID
          AND MONTH(OTDate) = MONTH(@OTDate)
          AND YEAR(OTDate) = YEAR(@OTDate)
      `);
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}     
    // 🔒 2️⃣ MONTH LOCK VALIDATION
    const today = new Date();
    const enteredDate = new Date(otDate);

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const otMonth = enteredDate.getMonth();
    const otYear = enteredDate.getFullYear();

    if (otMonth !== currentMonth || otYear !== currentYear) {
      return res.status(400).json({
        message: "OT entry is allowed only for the current month"
      });
    }
    // =============================
    // 2️⃣ WEEKLY OT LIMIT CHECK (12 hrs)
    // ==============================
const { monday, sunday } = getWeekRange(otDate);
const weeklyCheck = await pool.request()
  .input("EmpID", sql.Int, empId)
  .input("WeekStart", sql.Date, monday)
  .input("WeekEnd", sql.Date, sunday)
  .query(`
    SELECT ISNULL(SUM(OTHours), 0) AS TotalHours
    FROM OT_Records
    WHERE EmpID = @EmpID
      AND OTDate BETWEEN @WeekStart AND @WeekEnd
  `);
const weeklyTotal = weeklyCheck.recordset[0].TotalHours;
const weeklyNewTotal = weeklyTotal + otHours;

if (weeklyNewTotal > 12) {
  return res.status(400).json({
    message: "OT not allowed. Weekly OT limit exceeded (12 hrs)."
  });
}

const monthlyTotal = limitCheck.recordset[0].TotalHours;

// ✅ CHECK EXISTING + NEW OT
const newTotal = monthlyTotal + otHours;
if (newTotal > 48) {
  return res.status(400).json({
    message: "OT not allowed. Monthly OT limit exceeded (48 hrs)."
  });
}

    // 3️⃣ INSERT OT (ONLY IF ALLOWED)
  await pool.request()
  .input("EmpID", sql.Int, empId)
  .input("OTDate", sql.Date, otDate)
  .input("Shift", sql.VarChar(50), shift)
  .input("OTHours", sql.Decimal(4,2), otHours)
  .input("GivenBy", sql.VarChar(100), givenBy)
  .input("Reason", sql.VarChar(200), reason)
  .query(`
    INSERT INTO OT_Records
    (EmpID, OTDate, Shift, OTHours, GivenBy, Reason, Status)
    VALUES
    (@EmpID, @OTDate, @Shift, @OTHours, @GivenBy, @Reason, 'Pending')
  `);

    // 4️⃣ SUCCESS RESPONSE
    res.json({ message: "OT saved successfully" });

  } catch (err) {
    console.error("OT Insert Error:", err);
    res.status(500).json({ message: err.message });
  }
});


router.get("/summary", async (req, res) => {
  try {
    await poolConnect;
    const { deptId, empId, fromDate, toDate } = req.query;
    // ========================
    // 1️⃣ BUILD WHERE CLAUSE
    // ========================
    let whereClause = "WHERE o.status = 'Approved'";
if (deptId) whereClause += " AND e.DeptID = @DeptID";
if (empId) whereClause += " AND e.EmpID = @EmpID";
if (fromDate) whereClause += " AND o.OTDate >= @FromDate";
if (toDate) whereClause += " AND o.OTDate <= @ToDate";

const request = pool.request();
if (deptId) request.input("DeptID", sql.Int, deptId);
if (empId) request.input("EmpID", sql.Int, empId);
if (fromDate) request.input("FromDate", sql.Date, fromDate);
if (toDate) request.input("ToDate", sql.Date, toDate);

const recordsResult = await request.query(`
  SELECT
    d.DeptName,
    e.EmpID,
    e.EmpName,
    o.OTDate,
    o.Shift,
    o.start_time AS InTime,
    o.end_time AS OutTime,
    o.OTHours,
    o.GivenBy,
    o.approved_by AS ApprovedBy,
    o.approved_at AS ApprovedDate,
    o.Reason
  FROM OT_Records o
  JOIN Employees e ON o.EmpID = e.EmpID
  JOIN Departments d ON e.DeptID = d.DeptID
  ${whereClause}
  ORDER BY o.OTDate DESC, d.DeptName, e.EmpName
`);
    // ========================
    // 3️⃣ CALCULATE TOTAL OT
    // ========================
    const totalOT = recordsResult.recordset.reduce(
      (sum, r) => sum + r.OTHours,
      0
    );
    // ========================
    // 4️⃣ EMPLOYEE NAME
    // ========================
    let empName = "All";
    if (recordsResult.recordset.length > 0) {
      empName = recordsResult.recordset[0].EmpName;
    }
    // ========================
    // 5️⃣ SEND RESPONSE
    // ========================
    res.json({
      empName,
      totalOT,
      records: recordsResult.recordset
    });
  } catch (err) {
    console.error("OT SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/summary/export", async (req, res) => {
  try {
    await poolConnect;
    const { deptId, empId, fromDate, toDate } = req.query;
    let whereClause = "WHERE o.Status = 'Approved'";

    if (deptId) whereClause += " AND e.DeptID = @DeptID";
    if (empId) whereClause += " AND e.EmpID = @EmpID";
    if (fromDate) whereClause += " AND o.OTDate >= @FromDate";
    if (toDate) whereClause += " AND o.OTDate <= @ToDate";

    const request = pool.request();
    if (deptId) request.input("DeptID", sql.Int, deptId);
    if (empId) request.input("EmpID", sql.Int, empId);
    if (fromDate) request.input("FromDate", sql.Date, fromDate);
    if (toDate) request.input("ToDate", sql.Date, toDate);
    const result = await request.query(`
  SELECT
    e.EmpID,
    e.EmpName,
    d.DeptName AS DeptName,
    o.OTDate,
    o.Shift,
    o.start_time AS InTime,        
    o.end_time AS OutTime,         
    o.OTHours,
    o.GivenBy,
    o.approved_by AS ApprovedBy, 
    o.approved_at AS ApprovedDate,  
    o.Reason
  FROM OT_Records o
  JOIN Employees e ON o.EmpID = e.EmpID
  JOIN Departments d ON e.DeptID = d.DeptID
  ${whereClause}
  ORDER BY o.OTDate DESC
`);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("OT Summary");
    sheet.columns = [
      { header: "Employee ID", key: "EmpID", width: 15 },
      { header: "Employee Name", key: "EmpName", width: 20 },
      { header: "Department", key: "DeptName", width: 20 },
      { header: "Date", key: "OTDate", width: 15 },
      { header: "Shift", key: "Shift", width: 15 },
      { header: "OT Hours", key: "OTHours", width: 10 },
      { header: "Given By", key: "GivenBy", width: 20 },
      { header: "Reason", key: "Reason", width: 25 },
      { header: "Approved By", key: "ApprovedBy", width: 20 }, 
      { header: "Approved Date", key: "ApprovedDate", width: 18 }, 
      { header: "In Time", key: "InTime", width: 12 },        
      { header: "Out Time", key: "OutTime", width: 12 }
    ];
    result.recordset.forEach(r => {
  sheet.addRow({
    ...r,
    OTDate: new Date(r.OTDate).toLocaleDateString("en-GB"),
    ApprovedDate: r.ApprovedDate
      ? new Date(r.ApprovedDate).toLocaleDateString("en-GB")
      : ""
  });
});

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=OT_Summary.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/monthly-summary", async (req, res) => {
  try {
    await poolConnect;
    const { fromDate, toDate, deptId, empId } = req.body;
    const request = pool.request();
    // ✅ ALWAYS declare all parameters
    request.input("FromDate", sql.Date, fromDate);
    request.input("ToDate", sql.Date, toDate);
    request.input("DeptID", sql.Int, deptId ? Number(deptId) : null);
    request.input("EmpID", sql.Int, empId ? Number(empId) : null);
    const result = await request.query(`
  SELECT
    D.DeptName,
    E.EmpID,
    E.EmpName,
    FORMAT(O.OTDate, 'yyyy-MM') AS [Month],
    SUM(O.OTHours) AS TotalHours
  FROM Employees E
  JOIN Departments D ON E.DeptID = D.DeptID
  JOIN OT_Records O                    
    ON O.EmpID = E.EmpID
    AND O.Status = 'Approved'
    AND O.OTDate BETWEEN @FromDate AND @ToDate
  WHERE
    (@DeptID IS NULL OR E.DeptID = @DeptID)
    AND (@EmpID IS NULL OR E.EmpID = @EmpID)
  GROUP BY
    D.DeptName,
    E.EmpID,
    E.EmpName,
    FORMAT(O.OTDate, 'yyyy-MM')
  ORDER BY
    TotalHours DESC,
    E.EmpName;
`);

    res.json(result.recordset);
  } catch (err) {
    console.error("MONTHLY SUMMARY ERROR:", err);
    res.status(500).send("Server Error");
  }
});

router.post("/weekly-summary", async (req, res) => {
  try {
    await poolConnect;
    const { fromDate, toDate, deptId, empId } = req.body;
    const request = pool.request();
    request.input("FromDate", sql.Date, fromDate);
    request.input("ToDate", sql.Date, toDate);
    request.input("DeptID", sql.Int, deptId ? Number(deptId) : null);
    request.input("EmpID", sql.Int, empId ? Number(empId) : null);
    const result = await request.query(`
  SELECT
    D.DeptName,
    E.EmpID,
    E.EmpName,
    YEAR(O.OTDate) AS Year,
    DATEPART(ISO_WEEK, O.OTDate) AS WeekNo,
    SUM(O.OTHours) AS TotalHours
  FROM Employees E
  JOIN Departments D ON E.DeptID = D.DeptID
  JOIN OT_Records O                   
    ON O.EmpID = E.EmpID
    AND O.Status = 'Approved'
    AND O.OTDate BETWEEN @FromDate AND @ToDate
  WHERE
    (@DeptID IS NULL OR E.DeptID = @DeptID)
    AND (@EmpID IS NULL OR E.EmpID = @EmpID)
  GROUP BY
    D.DeptName,
    E.EmpID,
    E.EmpName,
    YEAR(O.OTDate),
    DATEPART(ISO_WEEK, O.OTDate)
  ORDER BY
    TotalHours DESC,
    E.EmpName;
`);
    res.json(result.recordset);
  } catch (err) {
    console.error("WEEKLY SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/monthly-total", async (req, res) => {
  try {
    await poolConnect;

    const { empId, date } = req.query;

    if (!empId || !date) {
      return res.status(400).json({ message: "empId and date required" });
    }

    const request = pool.request();
    request.input("EmpID", sql.Int, empId);
    request.input("OTDate", sql.Date, date);

    const result = await request.query(`
      SELECT 
        ISNULL(SUM(OTHours), 0) AS TotalHours
      FROM OT_Records
      WHERE EmpID = @EmpID
        AND MONTH(OTDate) = MONTH(@OTDate)
        AND YEAR(OTDate) = YEAR(@OTDate)
    `);
    res.json({
      totalHours: result.recordset[0].TotalHours
    });
  } catch (err) {
    console.error("MONTHLY TOTAL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/weekly-total", async (req, res) => {
  try {
    await poolConnect;

    const { empId, date } = req.query;

    if (!empId || !date) {
      return res.status(400).json({ message: "empId and date required" });
    }

    // 🔹 Week calculation
    function getWeekRange(date) {
      const d = new Date(date);
      const day = d.getDay(); // 0=Sun
      const diffToMonday = day === 0 ? -6 : 1 - day;

      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return { monday, sunday };
    }

    const { monday, sunday } = getWeekRange(date);

    const result = await pool.request()
      .input("EmpID", sql.Int, empId)
      .input("WeekStart", sql.Date, monday)
      .input("WeekEnd", sql.Date, sunday)
      .query(`
        SELECT ISNULL(SUM(OTHours), 0) AS TotalHours
        FROM OT_Records
        WHERE EmpID = @EmpID
          AND OTDate BETWEEN @WeekStart AND @WeekEnd
      `);

    res.json({
      totalHours: result.recordset[0].TotalHours
    });

  } catch (err) {
    console.error("WEEKLY TOTAL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/monthly-summary/export", async (req, res) => {
  try {
    await poolConnect;
    const { deptId, empId, fromDate, toDate } = req.query;
    // ========================
    // 1️⃣ BUILD WHERE CLAUSE
    // ========================
    let whereClause = "WHERE O.OTDate BETWEEN @FromDate AND @ToDate";
    const request = pool.request();
    request.input("FromDate", sql.Date, fromDate);
    request.input("ToDate", sql.Date, toDate);
    if (deptId) {
      whereClause += " AND E.DeptID = @DeptID";
      request.input("DeptID", sql.Int, Number(deptId));
    }

    if (empId) {
      whereClause += " AND E.EmpID = @EmpID";
      request.input("EmpID", sql.Int, Number(empId));
    }
    // ========================
    // 2️⃣ GET MONTHLY DATA
    // ========================
    const result = await request.query(`
SELECT
  D.DeptName,
  E.EmpID,
  E.EmpName,
  FORMAT(O.OTDate, 'yyyy-MM') AS [Month],
  SUM(O.OTHours) AS TotalHours
FROM OT_Records O
JOIN Employees E 
  ON O.EmpID = E.EmpID
JOIN Departments D 
  ON E.DeptID = D.DeptID
  AND O.Status = 'Approved'   -- ✅ Filter here
${whereClause}
GROUP BY
  D.DeptName,
  E.EmpID,
  E.EmpName,
  FORMAT(O.OTDate, 'yyyy-MM')
ORDER BY
  FORMAT(O.OTDate, 'yyyy-MM') DESC,
  D.DeptName,
  E.EmpID;
`);

    // ========================
    // 3️⃣ CREATE EXCEL
    // ========================
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monthly OT Summary");

    sheet.columns = [
      { header: "Department", key: "DeptName", width: 20 },
      { header: "Employee ID", key: "EmpID", width: 15 },
      { header: "Employee Name", key: "EmpName", width: 25 },
      { header: "Month", key: "Month", width: 15 },
      { header: "Total OT Hours", key: "TotalHours", width: 15 }
    ];
    // Header styling
    sheet.getRow(1).font = { bold: true };
    // Data rows
    result.recordset.forEach(r => {
      sheet.addRow(r);
    });
    // ========================
    // 4️⃣ SEND FILE
    // ========================
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Monthly_OT_Summary.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("MONTHLY EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ========================
// WEEKLY SUMMARY EXPORT
// ========================
router.get("/weekly-summary/export", async (req, res) => {
  try {
    await poolConnect;
    const { deptId, empId, fromDate, toDate } = req.query;
    let whereClause = "WHERE O.OTDate BETWEEN @FromDate AND @ToDate";
    const request = pool.request();

    request.input("FromDate", sql.Date, fromDate);
    request.input("ToDate", sql.Date, toDate);

    if (deptId) {
      whereClause += " AND E.DeptID = @DeptID";
      request.input("DeptID", sql.Int, Number(deptId));
    }
    if (empId) {
      whereClause += " AND E.EmpID = @EmpID";
      request.input("EmpID", sql.Int, Number(empId));
    }
    // ========================
    // GET WEEKLY DATA
    // ========================
    const result = await request.query(`
SELECT
  D.DeptName,
  E.EmpID,
  E.EmpName,
  YEAR(O.OTDate) AS Year,
  DATEPART(ISO_WEEK, O.OTDate) AS WeekNo,
  SUM(O.OTHours) AS TotalHours
FROM OT_Records O
JOIN Employees E 
  ON O.EmpID = E.EmpID
JOIN Departments D 
  ON E.DeptID = D.DeptID
  AND O.Status = 'Approved'   -- ✅ Only approved
${whereClause}
GROUP BY
  D.DeptName,
  E.EmpID,
  E.EmpName,
  YEAR(O.OTDate),
  DATEPART(ISO_WEEK, O.OTDate)
ORDER BY
  Year DESC,
  WeekNo DESC,
  E.EmpName;
`);
    // ========================
    // CREATE EXCEL
    // ========================
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Weekly OT Summary");
    sheet.columns = [
      { header: "Department", key: "DeptName", width: 20 },
      { header: "Employee ID", key: "EmpID", width: 15 },
      { header: "Employee Name", key: "EmpName", width: 25 },
      { header: "Year", key: "Year", width: 10 },
      { header: "Week No", key: "WeekNo", width: 10 },
      { header: "Total OT Hours", key: "TotalHours", width: 18 }
    ];
    sheet.getRow(1).font = { bold: true };
    result.recordset.forEach(r => {
      sheet.addRow(r);
    });
    // ========================
    // SEND FILE
    // ========================
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Weekly_OT_Summary.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("WEEKLY EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/hr/pending", async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT 
        o.OTID AS ID,
        o.EmpID,
        e.EmpName,
        d.DeptName,
        o.OTDate,
        o.OTHours,
        o.Shift,
        o.GivenBy,
        o.Reason
      FROM OT_Records o
      JOIN Employees e ON o.EmpID = e.EmpID
      JOIN Departments d ON e.DeptID = d.DeptID
      WHERE o.Status = 'Pending'
      ORDER BY o.OTDate DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("HR Pending Error:", err);
    res.status(500).json({ message: err.message });
  }
});
router.post("/hr/approve/:id", async (req, res) => {
  try {
    await poolConnect;
    const id = req.params.id;
    const startTime = req.body?.startTime;
    const endTime = req.body?.endTime;
    // 🔑 Get HR name from session
    const hrName = req.session.user?.empName;
    if (!req.session.user) {
      return res.status(401).json({ message: "User not logged in" });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({
        message: "Start and End time required"
      });
    }
    await pool.request()
      .input("ID", sql.Int, id)
      .input("start_time", sql.VarChar(20), startTime)
      .input("end_time", sql.VarChar(20), endTime)
      .input("approved_by", sql.VarChar(100), hrName)
      .query(`
        UPDATE OT_Records
        SET 
          Status = 'Approved',
          start_time = @start_time,
          end_time = @end_time,
          approved_by = @approved_by,
          approved_at = GETDATE()
        WHERE OTID = @ID
      `);
    res.json({ message: "OT Approved successfully" });
  } catch (err) {
    console.error("Approve Error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/hr/reject/:id", async (req, res) => {
  try {
    await poolConnect;
    const id = req.params.id;

    // 🔑 Get HR name from session
    const hrName = req.session.user?.empName;

    if (!req.session.user) {
      return res.status(401).json({ message: "User not logged in" });
    }

    await pool.request()
      .input("ID", sql.Int, id)
      .input("approved_by", sql.VarChar(100), hrName)
      .query(`
        UPDATE OT_Records
        SET 
          Status = 'Rejected',
          approved_by = @approved_by,
          approved_at = GETDATE()
        WHERE OTID = @ID
      `);

    res.json({ message: "OT Rejected successfully" });

  } catch (err) {
    console.error("Reject Error:", err);
    res.status(500).json({ message: err.message });
  }
});
const PDFDocument = require("pdfkit");


router.get("/summary/pdf", async (req, res) => {
  try {
    await poolConnect;

    const { deptId, empId, fromDate, toDate } = req.query;

    // ======================
    // WHERE CLAUSE
    // ======================
    let whereClause = "WHERE o.Status = 'Approved'";
    if (deptId) whereClause += " AND e.DeptID = @DeptID";
    if (empId) whereClause += " AND e.EmpID = @EmpID";
    if (fromDate) whereClause += " AND o.OTDate >= @FromDate";
    if (toDate) whereClause += " AND o.OTDate <= @ToDate";

    const request = pool.request();
    if (deptId) request.input("DeptID", sql.Int, deptId);
    if (empId) request.input("EmpID", sql.Int, empId);
    if (fromDate) request.input("FromDate", sql.Date, fromDate);
    if (toDate) request.input("ToDate", sql.Date, toDate);

    const result = await request.query(`
      SELECT
        e.EmpID,
        e.EmpName,
        d.DeptName,
        o.OTDate,
        o.Shift,
        o.OTHours,
        o.GivenBy,
        o.Reason,
        o.approved_by AS ApprovedBy,
        o.approved_at AS ApprovedDate,
        o.start_time AS InTime,
        o.end_time AS OutTime
      FROM OT_Records o
      JOIN Employees e ON o.EmpID = e.EmpID
      JOIN Departments d ON e.DeptID = d.DeptID
      ${whereClause}
      ORDER BY o.OTDate DESC
    `);

    // ======================
    // CREATE PDF
    // ======================
    const doc = new PDFDocument({
      margin: 20,
      size: "A4",
      layout: "landscape"
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=OT_Summary.pdf"
    );
    doc.pipe(res);
    // ======================
    // HEADER FUNCTION
    // ======================
    const drawPageHeader = () => {
      doc.fontSize(16).font("Helvetica-Bold")
        .text("OT SUMMARY REPORT", { align: "center" });

      doc.moveDown(0.5);

      doc.fontSize(10).font("Helvetica")
        .text(
          `From: ${fromDate || "All"}   To: ${toDate || "All"}`,
          { align: "center" }
        );
      doc.moveDown(0.4);
    };
    drawPageHeader();
    // ======================
    // TABLE SETTINGS
    // ======================
    const startX = 10;
    let y = 70;

    const columns = [
      { header: "Emp ID", key: "EmpID", width: 40 },
      { header: "Name", key: "EmpName", width: 80 },
      { header: "Dept", key: "DeptName", width: 50 },
      { header: "Date", key: "OTDate", width: 55 },
      { header: "Shift", key: "Shift", width: 45 },
      { header: "OT Hr", key: "OTHours", width: 30 },
      { header: "Given By", key: "GivenBy", width: 80 },
      { header: "Reason", key: "Reason", width: 135 },
      { header: "Approved", key: "ApprovedBy", width: 75 },
      { header: "Appr. Date", key: "ApprovedDate", width: 60 },
      { header: "In Time", key: "InTime", width: 50 },
      { header: "Out Time", key: "OutTime", width: 50 },
      { header: "Signature", key: "Sign", width: 60 }
    ];

    // ======================
    // DRAW TABLE HEADER
    // ======================
    const drawTableHeader = () => {
      let x = startX;
      doc.fontSize(9).font("Helvetica-Bold");

      columns.forEach(col => {
        doc.rect(x, y, col.width, 22)
          .fillAndStroke("#e6e6e6", "black");

        doc.fillColor("black").text(col.header, x + 2, y + 4, {
          width: col.width - 4,
          align: "center"
        });

        x += col.width;
      });

      y += 22;
      doc.font("Helvetica").fontSize(8);
    };

    drawTableHeader();

    // ======================
    // TABLE ROWS
    // ======================
    result.recordset.forEach(r => {
      let x = startX;
      const rowData = {
        EmpID: r.EmpID,
        EmpName: r.EmpName,
        DeptName: r.DeptName,
        OTDate: new Date(r.OTDate).toLocaleDateString("en-GB"),
        Shift: r.Shift,
        OTHours: r.OTHours,
        GivenBy: r.GivenBy,
        Reason: r.Reason || "-",
        ApprovedBy: r.ApprovedBy || "-",
        ApprovedDate: r.ApprovedDate
          ? new Date(r.ApprovedDate).toLocaleDateString("en-GB")
          : "-",
        InTime: r.InTime || "-",
        OutTime: r.OutTime || "-",
        Sign: ""
      };
      // Calculate dynamic height
      const reasonHeight = doc.heightOfString(rowData.Reason, {
        width: 126
      });
      const rowHeight = Math.max(25, reasonHeight + 10);
      // Page break check
      if (y + rowHeight > 570) {
        doc.addPage();
        y = 30;
       // drawPageHeader();
        drawTableHeader();
      }
      columns.forEach(col => {
        const text = rowData[col.key] || "";

        doc.rect(x, y, col.width, rowHeight).stroke();

        doc.text(String(text), x + 2, y + 6, {
          width: col.width - 4
        });

        x += col.width;
      });

      y += rowHeight;
    });

    // ======================
    // FOOTER SIGNATURE
    // ======================
    doc.moveDown(2);
    doc.fontSize(10);

    // Close PDF
    doc.end();

  } catch (err) {
    console.error("PDF EXPORT ERROR:", err);
    res.status(500).send("Error generating PDF");
  }
});

module.exports = router;