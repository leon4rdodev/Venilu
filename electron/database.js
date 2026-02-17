const {
    initializeDatabase,
    verifyUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
} = require('./db');

module.exports = {
    initializeDatabase: (path) => initializeDatabase(path),
    verifyUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
};