const express = require("express");
const router = express.Router();
const { authenticateCIAM, requireRegistration } = require("../middleware/ciamAuth");
const { authorizePermission } = require("../middleware/rbacAuth");
const { getUsersContainer } = require("../services/cosmosClient");

async function getClinicUserByUserId(userId, clinicName) {
  const container = getUsersContainer();
  const querySpec = {
    query: "SELECT TOP 1 * FROM c WHERE c.userId = @userId AND c.clinicName = @clinicName",
    parameters: [
      { name: "@userId", value: userId },
      { name: "@clinicName", value: clinicName },
    ],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources[0] || null;
}

router.get(
  "/pending",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      const container = getUsersContainer();
      const querySpec = {
        query:
          "SELECT * FROM c WHERE c.clinicName = @clinicName AND c.profileComplete = true AND c.approvalStatus = @approvalStatus",
        parameters: [
          { name: "@clinicName", value: req.userData.clinicName },
          { name: "@approvalStatus", value: "pending" },
        ],
      };

      const { resources } = await container.items.query(querySpec).fetchAll();
      return res.json(
        resources.sort(
          (a, b) =>
            new Date(b.updatedAt || b.created_at || 0).getTime() -
            new Date(a.updatedAt || a.created_at || 0).getTime()
        )
      );
    } catch (error) {
      console.error("Pending approvals error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to load pending approvals",
      });
    }
  }
);

router.put(
  "/:userId/approve",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      const existingUser = await getClinicUserByUserId(
        req.params.userId,
        req.userData.clinicName
      );

      if (!existingUser) {
        return res.status(404).json({
          error: "Not found",
          message: "User was not found for this clinic",
        });
      }

      const now = new Date().toISOString();
      const updatedUser = {
        ...existingUser,
        approvalStatus: "approved",
        prodAccessGranted: true,
        approvedBy: req.userData.email || req.user.email,
        approvedAt: now,
        rejectedBy: null,
        rejectedAt: null,
        updatedAt: now,
      };

      const { resource } = await getUsersContainer()
        .item(existingUser.id, existingUser.id)
        .replace(updatedUser);

      return res.json({
        success: true,
        user: resource,
      });
    } catch (error) {
      console.error("Approve user error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to approve user",
      });
    }
  }
);

router.put(
  "/:userId/reject",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      const existingUser = await getClinicUserByUserId(
        req.params.userId,
        req.userData.clinicName
      );

      if (!existingUser) {
        return res.status(404).json({
          error: "Not found",
          message: "User was not found for this clinic",
        });
      }

      const now = new Date().toISOString();
      const updatedUser = {
        ...existingUser,
        approvalStatus: "rejected",
        prodAccessGranted: false,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: req.userData.email || req.user.email,
        rejectedAt: now,
        updatedAt: now,
      };

      const { resource } = await getUsersContainer()
        .item(existingUser.id, existingUser.id)
        .replace(updatedUser);

      return res.json({
        success: true,
        user: resource,
      });
    } catch (error) {
      console.error("Reject user error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to reject user",
      });
    }
  }
);

module.exports = router;
