const jwt = require('jsonwebtoken');

async function generateChatbotToken(user) {
    try{
        const secretKey = process.env.JWT_SECRET;
        if (!secretKey) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        const payload = {
            userId: user.userId,
            clinicName: user.clinicName,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            specialty: user.specialty || user.specialization,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60)
        };
    
        const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' });
        return token;
    } catch (error) {
        console.error('Error generating chatbot token:', error);
        throw new Error('Failed to generate chatbot token');
    }
}

module.exports = {
    generateChatbotToken
};