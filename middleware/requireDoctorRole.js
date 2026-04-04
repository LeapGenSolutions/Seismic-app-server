function requireDoctorRole(req, res, next) {
  if (req.userData?.role !== "Doctor") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Only the account doctor can manage billing."
    });
  }
  next();
}

module.exports = requireDoctorRole;
