import express from 'express';
import verifyJWT from '../middleware/verifyJWT.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// Authentication
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
// Below are all private routes (require JWT authorization!!!)
router.use(verifyJWT);
router.post('/logout', userController.logoutUser);

// Profile Management
router.get('/profile', userController.getUserProfile);
router.get('/profile/socket-ticket', userController.getSocketTicket);
router.put('/profile', userController.updateUserProfile);
router.delete('/profile', userController.deleteUser);

// Saved Restaurants
router.get('/profile/saved-restaurants', userController.getSavedRestaurants);
router.post('/profile/saved-restaurants', userController.addSavedRestaurant);
router.delete('/profile/saved-restaurants/:restaurantId', userController.removeSavedRestaurant);

// User Aggregations (Lobbies & Friends)
router.get('/profile/lobbies', userController.getUserLobbies);

export default router;