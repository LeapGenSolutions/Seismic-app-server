const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Configure JWKS client to fetch public keys from Azure AD B2C for ID token verification
const client = jwksClient({
  jwksUri: process.env.CIAM_JWKS_URI || 'https://526922da-32fc-472e-a268-3875f1d50517.ciamlogin.com/526922da-32fc-472e-a268-3875f1d50517/discovery/v2.0/keys',
  cache: true,
  cacheMaxAge: 86400000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});


function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Error fetching signing key:', err);
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

async function verifyIdToken(token) {
  return new Promise((resolve, reject) => {

    const decodedUnverified = jwt.decode(token, { complete: true });

    if (!decodedUnverified) {
      console.error('Failed to decode token - token may be malformed');
      reject(new Error('Invalid ID token format'));
      return;
    }



    // Accept multiple issuer formats (Azure AD can use different endpoints)
    const tenantId = process.env.CIAM_TENANT_ID || '526922da-32fc-472e-a268-3875f1d50517';
    const acceptedIssuers = [
      `https://sts.windows.net/${tenantId}/`,
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`,
      process.env.CIAM_ISSUER
    ].filter(Boolean);

    // Build verification options
    const verifyOptions = {
      algorithms: ['RS256'],
      clockTolerance: 60
    };

    // Validate issuer - check if token issuer is in accepted list
    const tokenIssuer = decodedUnverified.payload.iss;
    if (!acceptedIssuers.includes(tokenIssuer)) {
      console.error(`Token issuer not accepted. Got: ${tokenIssuer}, Expected one of:`, acceptedIssuers);
      reject(new Error(`Token issuer not accepted: ${tokenIssuer}`));
      return;
    }

    console.log('Verification options:', verifyOptions);

    jwt.verify(
      token,
      getKey,
      verifyOptions,
      (err, decoded) => {
        if (err) {
          console.error('Token verification error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });

          if (err.name === 'TokenExpiredError') {
            reject(new Error('ID token has expired'));
          } else if (err.name === 'JsonWebTokenError') {
            reject(new Error('Invalid ID token'));
          } else if (err.name === 'NotBeforeError') {
            reject(new Error('ID token not yet valid'));
          } else {
            reject(new Error(`ID token verification failed: ${err.message}`));
          }
        } else {
          console.log('ID token verified successfully!');
          resolve(decoded);
        }
      }
    );
  });
}

function generateJWT(userPayload) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }


  const payload = {
    userId: userPayload.userId,
    email: userPayload.email
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRY || '24h',
    issuer: 'seismic-backend',
    audience: 'seismic-app'
  };

  return jwt.sign(payload, secret, options);
}


function verifyJWT(token) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'seismic-backend',
      audience: 'seismic-app'
    });
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Session token has expired');
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid session token');
    } else {
      throw new Error(`Token verification failed: ${err.message}`);
    }
  }
}

function extractUserInfo(tokenPayload, expectedUserId = null, expectedEmail = null) {
  // Extract common claims
  const userInfo = {
    userId: tokenPayload.sub || tokenPayload.oid,
    email: tokenPayload.email || tokenPayload.emails?.[0] || tokenPayload.preferred_username,
    name: tokenPayload.name,
    givenName: tokenPayload.given_name,
    familyName: tokenPayload.family_name,
    tokenIssuedAt: tokenPayload.iat,
    tokenExpiresAt: tokenPayload.exp
  };

  // Validate expected values if provided
  if (expectedUserId && userInfo.userId !== expectedUserId) {
    throw new Error('Token userId does not match expected value');
  }

  if (expectedEmail && userInfo.email !== expectedEmail) {
    throw new Error('Token email does not match expected value');
  }

  return userInfo;
}

module.exports = {
  verifyIdToken,
  generateJWT,
  verifyJWT,
  extractUserInfo
};
