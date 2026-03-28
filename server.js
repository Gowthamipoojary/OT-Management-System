const express = require("express");
const app = express();
const session = require("express-session");
const path = require("path");                                      
// BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// SESSION
app.use(session({
  secret: "ot-secret-key",
  resave: false,
  saveUninitialized: false
}));
// STATIC FILES (NO HTML AUTO SERVE)
app.use(express.static("public", { index: false }));

// ROOT - LOGIN
app.get("/", (req, res) => {
  res.redirect("/login.html");
});
// AUTH MIDDLEWARE
function checkAuth(req, res, next) {
  if (req.session.isLoggedIn) {
    next();
  } else {
    res.redirect("/login.html");
  }
}
// PROTECTED PAGES
app.get("/index", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/employee", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "employee.html"));
});
app.get("/monthlysummary", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "monthlysummary.html"));
});
app.get("/otsummary", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "otsummary.html"));
});
app.get("/hraproval", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "hraproval.html"));
});
app.get("/current-user", (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ message: "Not logged in" });
  }
});
// API ROUTES
app.use("/api/departments", require("./departmentRoutes"));
app.use("/api/employee", require("./employeeRoutes"));
app.use("/api/ot", require("./otRoutes"));
app.use("/login", require("./login"));

// SERVER
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});