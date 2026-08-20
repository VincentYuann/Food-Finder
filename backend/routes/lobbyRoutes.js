import express from 'express';
import verifyJWT from '../middleware/verifyJWT.js';
import isLobbyMember from '../middleware/isLobbyMember.js';
import isLobbyCreator from '../middleware/isLobbyCreator.js';
import * as lobbyController from '../controllers/lobbyController.js';

const router = express.Router();

// Every lobby route requires a logged-in user.
router.use(verifyJWT);

// Lobbies
router.get('/', lobbyController.getMyLobbies);
router.post('/', lobbyController.createLobby);
// Declared before '/:id' so the literal path always wins.
router.post('/join', lobbyController.joinLobbyByCode);

router.get('/:id', isLobbyMember, lobbyController.getLobby);
router.patch('/:id', isLobbyCreator, lobbyController.updateLobby);
router.delete('/:id', isLobbyCreator, lobbyController.deleteLobby);

// Members
router.get('/:id/members', isLobbyMember, lobbyController.getLobbyMembers);
router.delete('/:id/members/:userId', isLobbyMember, lobbyController.removeLobbyMember);
router.patch('/:id/members/ready', isLobbyMember, lobbyController.setMemberReady);

// Restaurant options
router.get('/:id/restaurants', isLobbyMember, lobbyController.getLobbyRestaurants);
router.post('/:id/restaurants', isLobbyMember, lobbyController.addLobbyRestaurant);

// Votes
router.get('/:id/votes', isLobbyMember, lobbyController.getLobbyVotes);
router.post('/:id/votes', isLobbyMember, lobbyController.castVote);

// Messages
router.get('/:id/messages', isLobbyMember, lobbyController.getLobbyMessages);
router.post('/:id/messages', isLobbyMember, lobbyController.sendLobbyMessage);

// Restaurant options
router.get('/:id/restaurants', isLobbyMember, lobbyController.getLobbyRestaurants);
router.post('/:id/restaurants', isLobbyMember, lobbyController.addLobbyRestaurant);
router.delete('/:id/restaurants/:restaurantId', isLobbyMember, lobbyController.removeLobbyRestaurant);

export default router;
