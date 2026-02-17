/**
 * Simple LRU Cache for reports data
 * Caches query results with TTL (Time To Live)
 */
class ReportsCache {
    constructor(maxSize = 50, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    /**
     * Generate cache key from parameters
     */
    generateKey(prefix, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}:${params[key]}`)
            .join('|');
        return `${prefix}:${sortedParams}`;
    }

    /**
     * Get cached data if exists and not expired
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    /**
     * Set cache data with timestamp
     */
    set(key, data) {
        // If cache is full, remove oldest entry (first in Map)
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Check if key exists and is not expired
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl
        };
    }
}

// Create singleton instance
const reportsCache = new ReportsCache();

module.exports = {
    ReportsCache,
    reportsCache
};
