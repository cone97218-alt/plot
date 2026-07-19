/**
 * store.js - Global in-memory state singleton
 * Provides get / set / subscribe. Does NOT handle persistence.
 */
const _state = {
    version: '0.4.0',
    modules: {},
    variables: {},
    goals: {},
    storylines: {},
    activeTab: 'settings',
    backstageActiveModeId: 'default',
    backstageActiveThemeId: 'default',
    backstageAvatarOption: 'show-frame',
    backstageStorageScope: 'chat',
    backstageHistory: [],
    pinnedGoalIds: [],
    isLoading: false,
};

const _subscribers = new Map();

export function get(key) {
    return _state[key];
}

export function set(key, value) {
    const oldValue = _state[key];
    _state[key] = value;
    
    // For objects/arrays, always trigger subscribers on set to avoid expensive JSON.stringify serialization.
    // For primitives, do a strict equality check.
    const hasChanged = (typeof value === 'object' && value !== null)
        ? true
        : oldValue !== value;

    if (hasChanged && _subscribers.has(key)) {
        _subscribers.get(key).forEach(fn => {
            try {
                fn(value, oldValue);
            } catch (e) {
                console.error(`[Plot Store] Subscriber error for key "${key}":`, e);
            }
        });
    }
}

export function subscribe(key, fn) {
    if (!_subscribers.has(key)) {
        _subscribers.set(key, new Set());
    }
    _subscribers.get(key).add(fn);
    
    return () => {
        if (_subscribers.has(key)) {
            _subscribers.get(key).delete(fn);
        }
    };
}
