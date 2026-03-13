const express = require('express');
const {
	getAllUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser
} = require('../controllers/userController');

const router = express.Router();

// GET /users
router.get('/', getAllUsers);

// GET /users/:id (Route Parameters)
router.get('/:id', getUserById);

// POST /users (Request Body)
router.post('/', createUser);

// PUT /users/:id (Full update)
router.put('/:id', updateUser);

// PATCH /users/:id (Partial update)
router.patch('/:id', updateUser);

// DELETE /users/:id
router.delete('/:id', deleteUser);

module.exports = router;






