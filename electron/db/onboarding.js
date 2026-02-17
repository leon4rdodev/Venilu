const { getDb, allAsync } = require('./connection');

/**
 * Check if onboarding has been completed
 * Onboarding is considered complete if at least one admin user exists
 * @returns {Promise<Object>} Result object with completed status
 */
async function checkOnboardingStatus() {
    try {
        const admins = await allAsync(
            'SELECT id FROM users WHERE role = ? LIMIT 1',
            ['admin']
        );

        const isCompleted = admins.length > 0;

        return {
            success: true,
            completed: isCompleted,
            message: isCompleted ? 'Onboarding already completed' : 'Onboarding required'
        };
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        return {
            success: false,
            completed: false,
            message: 'Error checking onboarding status',
            error: error.message
        };
    }
}

module.exports = {
    checkOnboardingStatus,
};
