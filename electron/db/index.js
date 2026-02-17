const { initializeDatabase, getDb } = require('./connection');
const {
    verifyUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
} = require('./users');
const {
    getProducts,
    getAllProducts,
    getProductsForPOS,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    getInventoryStats,
    createProductIndices,
} = require('./products');
const {
    createShift,
    getActiveShift,
    closeShift,
    getShiftsWithDetails,
} = require('./shifts');
const {
    getSettings,
    updateSettings,
} = require('./settings');
const { getCategories, createCategory, updateCategory, deleteCategory, getCategoriesWithCount } = require('./categories');
const { checkOnboardingStatus } = require('./onboarding');

module.exports = {
    // Connection
    initializeDatabase,

    // Users
    verifyUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,

    // Products
    getProducts,
    getProductsForPOS,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    getInventoryStats,
    createProductIndices,

    // Shifts
    createShift,
    getActiveShift,
    closeShift,
    getShiftsWithDetails,

    // Settings
    getSettings,
    updateSettings,

    // Categories
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesWithCount,

    // Onboarding
    checkOnboardingStatus,
};