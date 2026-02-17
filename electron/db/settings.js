const { getDb, runAsync, allAsync } = require('./connection');

/**
 * Get application settings
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
    try {
        const settings = await allAsync('SELECT * FROM settings WHERE id = 1', []);
        
        if (settings.length === 0) {
            // Return default settings if none exist
            return {
                success: true,
                settings: {
                    id: 1,
                    business_name: '',
                    business_address: '',
                    business_phone: '',
                    business_email: '',
                    business_tax_id: '',
                    logo_filename: null,
                    printer_name: null,
                    paper_size: '80mm'
                }
            };
        }
        
        return { success: true, settings: settings[0] };
    } catch (error) {
        console.error('Error getting settings:', error.message);
        return { success: false, message: 'Failed to get settings.', error: error.message };
    }
}

/**
 * Update application settings (upsert)
 * @param {Object} settingsData - Settings data to update
 * @returns {Promise<Object>} Result object
 */
async function updateSettings(settingsData) {
    try {
        const {
            business_name,
            business_address,
            business_phone,
            business_email,
            business_tax_id,
            logo_filename,
            printer_name,
            paper_size
        } = settingsData;

        // Check if settings exist
        const existing = await allAsync('SELECT * FROM settings WHERE id = 1', []);
        
        if (existing.length === 0) {
            // Insert new settings
            await runAsync(
                `INSERT INTO settings (id, business_name, business_address, business_phone, business_email, business_tax_id, logo_filename, printer_name, paper_size)
                 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    business_name || '',
                    business_address || '',
                    business_phone || '',
                    business_email || '',
                    business_tax_id || '',
                    logo_filename || null,
                    printer_name || null,
                    paper_size || '80mm'
                ]
            );
        } else {
            // Update existing settings - Merge with existing data to prevent overwriting with null/undefined
            const current = existing[0];
            
            // Helper to get value: prefer new value if defined, else keep old
            const getVal = (newVal, oldVal) => (newVal !== undefined ? newVal : oldVal);

            await runAsync(
                `UPDATE settings SET
                    business_name = ?,
                    business_address = ?,
                    business_phone = ?,
                    business_email = ?,
                    business_tax_id = ?,
                    logo_filename = ?,
                    printer_name = ?,
                    paper_size = ?
                 WHERE id = 1`,
                [
                    getVal(business_name, current.business_name),
                    getVal(business_address, current.business_address),
                    getVal(business_phone, current.business_phone),
                    getVal(business_email, current.business_email),
                    getVal(business_tax_id, current.business_tax_id),
                    getVal(logo_filename, current.logo_filename),
                    getVal(printer_name, current.printer_name),
                    getVal(paper_size, current.paper_size)
                ]
            );
        }
        
        return { success: true, message: 'Settings updated successfully.' };
    } catch (error) {
        console.error('Error updating settings:', error.message);
        return { success: false, message: 'Failed to update settings.', error: error.message };
    }
}

module.exports = {
    getSettings,
    updateSettings,
};
