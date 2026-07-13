export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "ghe-compliance-secret-key-change-in-production",
  jwtExpiresIn: "7d",
};
