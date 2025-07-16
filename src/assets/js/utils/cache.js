const db = new loki('404launcher-cache.db', {
    adapter: new loki.LokiFsAdapter(),
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true,
    autosaveInterval: 4000
});

function databaseInitialize() {
    let instances = db.getCollection("instances");
    if (instances === null) {
        instances = db.addCollection("instances");
    }
}

class Cache {
    constructor(db) {
        this.db = db;
    }

    async get(key) {
        const collection = this.db.getCollection('instances');
        return collection.findOne({ key: key });
    }

    async set(key, value, ttl) {
        const collection = this.db.getCollection('instances');
        const existing = collection.findOne({ key: key });
        const expires = Date.now() + ttl;
        if (existing) {
            existing.value = value;
            existing.expires = expires;
            collection.update(existing);
        } else {
            collection.insert({ key: key, value: value, expires: expires });
        }
    }

    async isExpired(key) {
        const item = await this.get(key);
        if (!item) return true;
        return Date.now() > item.expires;
    }
}

const cache = new Cache(db);
