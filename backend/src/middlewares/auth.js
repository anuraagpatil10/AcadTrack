const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            
            if (roles.length && !roles.includes(decoded.role) && decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
    };
};

module.exports = authMiddleware;
