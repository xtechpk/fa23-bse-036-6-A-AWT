const getProducts = (req, res) => {
  const products = [
    { id: 1, name: 'Wireless Mouse', price: 25.99 },
    { id: 2, name: 'Mechanical Keyboard', price: 79.99 },
    { id: 3, name: 'USB-C Hub', price: 39.5 }
  ];

  res.status(200).json({
    success: true,
    data: products
  });
};

module.exports = {
  getProducts
};
