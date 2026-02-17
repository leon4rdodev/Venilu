const { getDb, runAsync, allAsync } = require('./connection');

/**
 * Get all categories
 * @returns {Promise<Object>} Categories list
 */
async function getCategories() {
    try {
        const categories = await allAsync(
            'SELECT id, name, created_at FROM categories ORDER BY name ASC',
            []
        );

        return { success: true, categories };
    } catch (error) {
        console.error('Error getting categories:', error.message);
        return { success: false, message: 'Failed to get categories.', error: error.message, categories: [] };
    }
}

/**
 * Create a new category
 * @param {string} name - Category name
 * @returns {Promise<Object>} Result object
 */
async function createCategory(name) {
    try {
        // Validate and sanitize
        const trimmedName = name.trim();

        if (!trimmedName) {
            return { success: false, message: 'El nombre de la categoría no puede estar vacío.' };
        }

        // Check for duplicates (case-insensitive)
        const existing = await allAsync(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
            [trimmedName]
        );

        if (existing.length > 0) {
            return { success: false, message: 'Ya existe una categoría con ese nombre.' };
        }

        const createdAt = new Date().toISOString();
        const result = await runAsync(
            'INSERT INTO categories (name, created_at) VALUES (?, ?)',
            [trimmedName, createdAt]
        );

        return {
            success: true,
            category: {
                id: result.lastID,
                name: trimmedName,
                created_at: createdAt
            }
        };
    } catch (error) {
        console.error('Error creating category:', error.message);
        return { success: false, message: 'Failed to create category.', error: error.message };
    }
}

/**
 * Update a category
 * @param {number} id - Category ID
 * @param {string} name - New name
 * @returns {Promise<Object>} Result object
 */
async function updateCategory(id, name) {
    try {
        const trimmedName = name.trim();

        if (!trimmedName) {
            return { success: false, message: 'El nombre de la categoría no puede estar vacío.' };
        }

        // Check for duplicates (case-insensitive), excluding current category
        const existing = await allAsync(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
            [trimmedName, id]
        );

        if (existing.length > 0) {
            return { success: false, message: 'Ya existe una categoría con ese nombre.' };
        }

        await runAsync(
            'UPDATE categories SET name = ? WHERE id = ?',
            [trimmedName, id]
        );

        return { success: true, message: 'Category updated successfully.' };
    } catch (error) {
        console.error('Error updating category:', error.message);
        return { success: false, message: 'Failed to update category.', error: error.message };
    }
}

/**
 * Delete a category
 * @param {number} id - Category ID
 * @returns {Promise<Object>} Result object
 */
async function deleteCategory(id) {
    try {
        // Check if any products use this category
        const productsUsingCategory = await allAsync(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [id]
        );

        if (productsUsingCategory[0].count > 0) {
            return {
                success: false,
                message: `No se puede eliminar la categoría porque ${productsUsingCategory[0].count} producto(s) la están usando.`
            };
        }

        await runAsync('DELETE FROM categories WHERE id = ?', [id]);

        return { success: true, message: 'Category deleted successfully.' };
    } catch (error) {
        console.error('Error deleting category:', error);
        return { success: false, message: 'Failed to delete category.', error: error.message };
    }
}

/**
 * Get category with product count
 * @returns {Promise<Object>} Categories with counts
 */
async function getCategoriesWithCount() {
    try {
        const categories = await allAsync(
            `SELECT c.id, c.name, c.created_at, COUNT(p.id) as product_count
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id
             GROUP BY c.id, c.name, c.created_at
             ORDER BY c.name ASC`,
            []
        );

        return { success: true, categories };
    } catch (error) {
        console.error('Error getting categories with count:', error);
        return { success: false, message: 'Failed to get categories.', error: error.message, categories: [] };
    }
}

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesWithCount,
};
