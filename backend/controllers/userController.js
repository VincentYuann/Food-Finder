import bcrypt from 'bcrypt';
import prisma from '../config/dbConfig.js';
import jwt from 'jsonwebtoken';

// ==========================================
// AUTHENTICATION
// ==========================================

export const registerUser = async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // Basic validation
        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, username, and password are required.' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Email or username already in use.' });
        }

        // Hash the password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Save the new user to the database
        const newUser = await prisma.user.create({
            data: {
                email,
                username,
                password_hash: hashedPassword,
            },
        });

        // Send success response
        res.status(201).json({
            message: 'User created successfully',
            user: { id: newUser.id, email: newUser.email, username: newUser.username }
        });

    } catch (error) {
        console.error('Error in registerUser:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, username, password } = req.body;

        // Basic validation
        if ((!email && !username) || !password) {
            return res.status(400).json({ error: 'Please provide an email/username and password.' });
        }

        // Find the user by email OR username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email || '' },
                    { username: username || '' }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Compare the provided password with the stored hash
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate a JWT token
        // This signs the user's ID into the token so your auth middleware can read it later
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // ADD THIS: Set the token in an HttpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Deployment makes NODE_ENV true, and blocking requests if its only HTTP
            sameSite: 'none',
            maxAge: 1 * 24 * 60 * 60 * 1000
        });

        // Send success response (Notice: token is removed from this JSON payload)
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_image_url: user.profile_image_url
            }
        });

    } catch (error) {
        console.error('Error in loginUser:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const logoutUser = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully.' });
};

// ==========================================
// PROFILE MANAGEMENT
// ==========================================

export const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                profile_image_url: true,
                created_at: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const { username, email, profile_image_url } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { username, email, profile_image_url },
            select: { id: true, username: true, email: true, profile_image_url: true },
        });

        res.status(200).json({ message: 'Profile updated', user: updatedUser });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        await prisma.user.delete({ where: { id: userId } });

        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// SAVED RESTAURANTS
// ==========================================

export const getSavedRestaurants = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const saved = await prisma.savedRestaurant.findMany({
            where: { user_id: userId },
            include: { restaurant: true }, // Joins the actual restaurant data
            orderBy: { saved_at: 'desc' }
        });

        res.status(200).json(saved);
    } catch (error) {
        console.error('Error fetching saved restaurants:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const addSavedRestaurant = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const restaurantId = parseInt(req.body.restaurant_id, 10);

        if (!restaurantId) {
            return res.status(400).json({ error: 'Restaurant ID is required.' });
        }

        // Use upsert or create with a catch for duplicates
        const newSave = await prisma.savedRestaurant.upsert({
            where: {
                user_id_restaurant_id: {
                    user_id: userId,
                    restaurant_id: restaurantId,
                },
            },
            // If it already exists, just do nothing (or update timestamp if you have one)
            update: {},
            // If it doesn't exist, create it
            create: {
                user_id: userId,
                restaurant_id: restaurantId,
            },
        });

        res.status(201).json({ message: 'Restaurant saved successfully', data: newSave });
    } catch (error) {
        console.error('Error saving restaurant:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const removeSavedRestaurant = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const restaurantId = parseInt(req.params.restaurantId, 10);

        await prisma.savedRestaurant.delete({
            where: {
                // Targets the @@unique constraint defined in your schema
                user_id_restaurant_id: {
                    user_id: userId,
                    restaurant_id: restaurantId,
                },
            },
        });

        res.status(200).json({ message: 'Restaurant removed from saved list.' });
    } catch (error) {
        console.error('Error removing saved restaurant:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// USER AGGREGATIONS
// ==========================================

export const getUserLobbies = async (req, res) => {
    try {
        const userId = req.user.id; // already a Number, normalized by verifyJWT
        const memberships = await prisma.lobbyMember.findMany({
            where: { user_id: userId },
            include: {
                lobby: true // Joins the lobby data so the client can display it
            },
            orderBy: { joined_at: 'desc' }
        });

        res.status(200).json(memberships);
    } catch (error) {
        console.error('Error fetching user lobbies:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

