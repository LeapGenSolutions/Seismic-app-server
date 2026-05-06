const { CosmosClient } = require("@azure/cosmos");
const { getUsersContainer } = require("./cosmosClient");
const { buildBootstrapOverrides } = require("./bootstrapPermissions");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function insertCallHistory(id, reqBody) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const { resource } = await container.items.upsert({ id, ...reqBody });
        return resource;
    } catch (error) {
        throw new Error("Item not Inserted");
    }
}

async function updateCallHistory(id, updatedBody) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT * from c where c.id="${id}"` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        const existingItem = items[0];
        const updatedItem = { ...existingItem, ...updatedBody };
        const { resource: replacedItem } = await container.item(id, existingItem.userID).replace(updatedItem);
        return replacedItem;
    } catch (error) {
        throw new Error("Item not updated");
    }
}

async function fetchEmailFromCallHistory(id) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT * from c where c.appointmentID="${id}"` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0].userID;
    } catch (error) {
        throw new Error("Item not found");
    }
}

function normalizeClinicName(clinicName) {
    return (clinicName || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getAdminPermissionLevel(user) {
    return user?.customPermissions?.overrides?.["admin.manage_rbac"] || "none";
}

function getBootstrapSortValue(user) {
    return (
        user?.created_at ||
        user?.createdAt ||
        user?.updatedAt ||
        user?.lastLoginAt ||
        user?.doctor_email ||
        user?.email ||
        user?.id ||
        ""
    );
}

function omitBaaSignatureHistory(user = {}) {
    const nextUser = { ...user };
    delete nextUser.baaSignatureHistory;
    return nextUser;
}

async function ensureBootstrapClinicAdmins(users = []) {
    const container = getUsersContainer();
    const usersByClinic = users.reduce((acc, user) => {
        const clinicKey = normalizeClinicName(user?.clinicName);
        if (!clinicKey) {
            return acc;
        }

        if (!acc[clinicKey]) {
            acc[clinicKey] = [];
        }

        acc[clinicKey].push(user);
        return acc;
    }, {});

    const updatedUsers = new Map();

    for (const clinicUsers of Object.values(usersByClinic)) {
        const completedUsers = clinicUsers.filter((user) => user?.profileComplete === true);
        if (completedUsers.length === 0) {
            continue;
        }

        const alreadyHasAdmin = completedUsers.some((user) => {
            const level = getAdminPermissionLevel(user);
            return level === "read" || level === "write";
        });

        if (alreadyHasAdmin) {
            continue;
        }

        const bootstrapUser = [...completedUsers].sort((a, b) =>
            String(getBootstrapSortValue(a)).localeCompare(String(getBootstrapSortValue(b)))
        )[0];

        if (!bootstrapUser?.id) {
            continue;
        }

        const updatedAt = new Date().toISOString();
        const nextOverrides = buildBootstrapOverrides(
            bootstrapUser.role,
            (bootstrapUser.customPermissions && bootstrapUser.customPermissions.overrides) || {}
        );
        const updatedUser = {
            ...bootstrapUser,
            customPermissions: {
                ...(bootstrapUser.customPermissions || {}),
                overrides: nextOverrides,
                lastUpdatedBy: "system-bootstrap",
                lastUpdatedAt: updatedAt,
            },
            permissionAuditLog: [
                ...((bootstrapUser.permissionAuditLog || []).slice(-49)),
                {
                    action: "bootstrap_clinic_admin_granted",
                    permission: "admin.manage_rbac",
                    newLevel: "write",
                    performedBy: "system-bootstrap",
                    timestamp: updatedAt,
                    clinicName: bootstrapUser.clinicName || "",
                },
                ...(bootstrapUser.role === "Staff"
                    ? [{
                        action: "bootstrap_clinic_admin_restricted",
                        newLevel: "admin-only",
                        performedBy: "system-bootstrap",
                        timestamp: updatedAt,
                        clinicName: bootstrapUser.clinicName || "",
                    }]
                    : []),
            ],
            updatedAt,
        };
        delete updatedUser.baaSignatureHistory;

        const { resource } = await container
            .item(bootstrapUser.id, bootstrapUser.id)
            .replace(updatedUser);

        updatedUsers.set(resource.id, omitBaaSignatureHistory(resource));
    }

    return users.map((user) => updatedUsers.get(user.id) || omitBaaSignatureHistory(user));
}

async function fetchDoctors(clinicName) {
    const container = getUsersContainer();

    try {
        let querySpec = { query: `SELECT * from c` };
        if (clinicName) {
            querySpec = {
                query: `SELECT * from c WHERE LTRIM(RTRIM(LOWER(c.clinicName))) = @clinicName`,
                parameters: [{ name: "@clinicName", value: clinicName.replace(/\s+/g, " ").trim().toLowerCase() }]
            };
        }
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        const users = await ensureBootstrapClinicAdmins(items);
        return users.map(omitBaaSignatureHistory);
    } catch (error) {
        console.error("Error in fetchDoctors:", error);
        throw new Error("Item not found");
    }
}

// Fetch call history for multiple emails
async function fetchCallHistoryFromEmails(userIDs) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        // Use IN clause for multiple userIDs, limit to 10 per userID
        const userIDsList = userIDs.map(id => `\"${id}\"`).join(",");
        const querySpec = {
            query: `SELECT * from c WHERE c.userID IN (${userIDsList})`
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        // Optionally, group by userID and limit to 10 per userID
        // Here, just return all results
        return items;
    } catch (error) {
        throw new Error("Items not found");
    }
}


// Check if appointmentIDs exist in the container
async function checkAppointmentsInCallHistory(appointmentIDs) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const idsList = appointmentIDs.map(id => `\"${id}\"`).join(",");
        const querySpec = {
            query: `SELECT distinct(c.appointmentID) from c WHERE c.appointmentID IN (${idsList})`
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items;
    } catch (error) {
        throw new Error("Items not found");
    }
}

module.exports = {
    insertCallHistory,
    updateCallHistory,
    fetchEmailFromCallHistory,
    fetchDoctors,
    fetchCallHistoryFromEmails,
    checkAppointmentsInCallHistory
};
