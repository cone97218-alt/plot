/**
 * migrator.js - Schema version migration
 * Detects data version, runs sequential migration scripts to bring data up to current version.
 *
 * All backward-compatibility shims belong here, NOT in individual modules.
 */

const CURRENT_VERSION = '0.5.0';

export function detectVersion(data) {
    return data?.version || '0.1.0';
}

const migrations = {
    '0.2.0': (data) => {
        if (!data.modules) data.modules = {};
        data.version = '0.2.0';
        return data;
    },
    '0.3.0': (data) => {
        if (!data.prompts) data.prompts = [];
        data.version = '0.3.0';
        return data;
    },
    '0.4.0': (data) => {
        if (!data.variables) data.variables = {};
        if (!data.goals) data.goals = {};
        if (!data.storylines) data.storylines = {};
        data.version = '0.4.0';
        return data;
    },
    // v0.5.0: migrate reading settings field renames
    // Previously handled inline inside context-reader.js getReadingSettings()
    '0.5.0': (data) => {
        const r = data.reading;
        if (r) {
            // regexFilters (old array of strings) -> regexRules (array of objects)
            if (r.regexFilters && !r.regexRules) {
                r.regexRules = r.regexFilters.map((p, idx) => ({
                    id: 'rule_' + Date.now() + '_' + idx,
                    name: `正则过滤 ${idx + 1}`,
                    find: p,
                    replace: '',
                    disabled: false
                }));
                delete r.regexFilters;
            }
            // manuallySelectedUids (old number[]) -> manuallySelectedEntries ("book:uid" strings)
            if (r.manuallySelectedUids && r.manuallySelectedUids.length > 0 && !r.manuallySelectedEntries) {
                r.manuallySelectedEntries = r.manuallySelectedUids.map(
                    uid => `${r.customLorebookName || 'default'}:${uid}`
                );
                delete r.manuallySelectedUids;
            }
        }
        data.version = '0.5.0';
        return data;
    }
};

const versionChain = ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0'];

export function migrate(data, fromVersion = null, toVersion = CURRENT_VERSION) {
    if (!data) return data;
    
    let currentV = fromVersion || detectVersion(data);
    if (currentV === toVersion) return data;
    
    const startIndex = versionChain.indexOf(currentV);
    const endIndex = versionChain.indexOf(toVersion);
    
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        data.version = toVersion;
        return data;
    }
    
    let migratedData = { ...data };
    for (let i = startIndex + 1; i <= endIndex; i++) {
        const nextVersion = versionChain[i];
        if (migrations[nextVersion]) {
            try {
                migratedData = migrations[nextVersion](migratedData);
                console.log(`[Plot Migrator] Successfully migrated data from version ${currentV} to ${nextVersion}`);
            } catch (e) {
                console.error(`[Plot Migrator] Failed migrating from version ${currentV} to ${nextVersion}:`, e);
            }
        }
        currentV = nextVersion;
    }
    
    return migratedData;
}
