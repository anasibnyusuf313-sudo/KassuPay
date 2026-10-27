function adminMiddleware(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || !process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Staff only" });
  }
  next();
}

module.exports = adminMiddleware;