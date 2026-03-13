const express = require('express');
const { getProducts } = require('../controllers/productController');

const router = express.Router();

// GET /products
router.get('/', getProducts);

module.exports = router;
