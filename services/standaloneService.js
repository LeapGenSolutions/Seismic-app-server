const { getUsersContainer } = require("./cosmosClient");

async function checkNPIDuplicate(npiNumber) {
  const container = getUsersContainer();

  const querySpec = {
    query: "SELECT * FROM c WHERE c.npiNumber = @npiNumber",
    parameters: [{ name: "@npiNumber", value: npiNumber }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources.length > 0;
}


async function verifyStandaloneAuth(email, userId) {

  const container = getUsersContainer();

  // Cross-partition query by userId
  const querySpec = {
    query: "SELECT * FROM c WHERE c.userId = @userId",
    parameters: [{ name: "@userId", value: userId }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();

  // First-time user - auto-create record
  if (resources.length === 0) {
    console.log('First-time standalone user, creating record...');

    const newUser = {
      id: email,  // Using email as partition key (id)
      userId: userId,
      email: email,

      // Map to existing doctor container fields
      doctor_id: userId,
      doctor_email: email,
      doctor_name: "",  // Will be filled during registration

      authType: "CIAM",
      profileComplete: false,
      prodAccessGranted: true,
      isActive: true,
      created_at: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    await container.items.create(newUser);

    return {
      isFirstTime: true,
      profileComplete: false,
      userId: userId,
      email: email
    };
  }

  // Returning user
  const user = resources[0];

  // Update last login using email as partition key
  await container.item(user.id, user.id).patch([
    {
      op: "replace",
      path: "/lastLoginAt",
      value: new Date().toISOString()
    }
  ]);

  return {
    isFirstTime: false,
    profileComplete: user.profileComplete || false,
    userId: user.userId,
    email: user.email,
    userData: user.profileComplete ? {
      firstName: user.firstName,
      lastName: user.lastName,
      npiNumber: user.npiNumber,
      specialty: user.specialty,
      role: user.role
    } : undefined
  };
}


async function registerStandaloneUser(data) {
  const container = getUsersContainer();

   // Check for duplicate NPI
  const npiExists = await checkNPIDuplicate(data.npiNumber);
  if (npiExists) {
    throw new Error("NPI_DUPLICATE");
  }

  // Cross-partition query to fetch existing user record by userId
  const querySpec = {
    query: "SELECT * FROM c WHERE c.userId = @userId",
    parameters: [{ name: "@userId", value: data.userId }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();

  if (resources.length === 0) {
    throw new Error("User not found");
  }

  const existingUser = resources[0];

  // Update user with registration data
  const updatedUser = {
    ...existingUser,

    // Name fields
    firstName: data.firstName,
    middleName: data.middleName || "",
    lastName: data.lastName,

    // Email fields
    primaryEmail: data.primaryEmail,
    secondaryEmail: data.secondaryEmail || "",

    // Professional Info
    role: data.role,
    npiNumber: data.npiNumber,
    specialty: data.specialty,
    subSpecialty: data.subSpecialty || "",
    statesOfLicense: data.statesOfLicense,
    licenseNumber: data.licenseNumber || "",

    // Practice Info
    clinicName: data.clinicName || "",
    practiceAddress: data.practiceAddress || {},

    // Legal Agreements
    termsAccepted: data.termsAccepted,
    privacyAccepted: data.privacyAccepted,
    clinicalResponsibilityAccepted: data.clinicalResponsibilityAccepted,

    // Map to existing doctor container fields
    doctor_name: `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`.trim(),
    doctor_email: data.primaryEmail,
    specialization: data.specialty,

    // Status
    profileComplete: true,
    updatedAt: new Date().toISOString()
  };

  
  const { resource } = await container
    .item(existingUser.id, existingUser.id)
    .replace(updatedUser);

        console.log('User standalone Registration : Success, record updated');


  return resource;
}





module.exports = {
  verifyStandaloneAuth,
  registerStandaloneUser,
  checkNPIDuplicate
};