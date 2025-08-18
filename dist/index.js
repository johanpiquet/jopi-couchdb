// noinspection JSUnusedGlobalSymbols
import "jopi-node-space";
const tick = NodeSpace.timer.tick;
//endregion
export class CouchDbError extends Error {
    // noinspection JSUnusedGlobalSymbols
    constructor(message, status, statusText, request, errorBody) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.request = request;
        this.errorBody = errorBody;
    }
}
export async function doCall(self, method, urlPath, params) {
    // Allow knowing the call-stack.
    //const errorStack = new Error().stack;
    params = params || {};
    if (params.params) {
        const searchParams = new URLSearchParams();
        for (const [k, v] of Object.entries(params.params)) {
            if (Array.isArray(v)) {
                v.forEach(item => {
                    searchParams.append(k, String(item));
                });
            }
            else if (typeof v === 'object') {
                searchParams.append(k, JSON.stringify(v));
            }
            searchParams.append(k, String(v));
        }
        urlPath += '?' + searchParams.toString();
    }
    let body = params.body;
    let isJson = false;
    if (body && !body.getReader) {
        isJson = true;
        body = JSON.stringify(params.body);
    }
    const headers = {
        ...params.headers,
        "Authorization": self.credentials,
        "Accept": "application/json",
    };
    if (isJson)
        headers["Content-Type"] = "application/json";
    if (params.debug) {
        console.log(`Fetching ${self.url + urlPath} with params`, { method, body: params.body, headers });
        debugger;
    }
    let response;
    try {
        response = await fetch(self.url + urlPath, {
            method, body, headers,
            //@ts-ignore Duplex
            duplex: 'half'
        });
    }
    catch (e) {
        console.error("CouchDB Server not connected !", e);
        throw new Error("CouchDB Server not connected !");
    }
    if (!response.ok) {
        throw new CouchDbError(`CouchDB - ${response.status} - ${response.statusText}`, response.status, response.statusText, method + "|" + urlPath, await response.text());
    }
    return response.json();
}
export class CouchDriver {
    constructor(url, login, password) {
        this.url = url;
        this.credentials = "Basic " + btoa(`${login}:${password}`);
    }
    getDb(dbName) {
        return new CouchDB(this, dbName, this.url, this.credentials);
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * List all the databases.
     * See: http://127.0.0.1:5984/_utils/docs/api/server/common.html#all-dbs
     */
    listAllDb(params) {
        return doCall(this, "GET", "/_all_dbs", { params });
    }
    /**
     * Create a new db.
     * Do nothing if db already exists.
     */
    async createDb(dbName) {
        try {
            await doCall(this, "PUT", `/${dbName}`);
        }
        catch (e) {
            if (e.status === 400)
                throw "Illegal database name.";
        }
        return this.getDb(dbName);
    }
    /**
     * Delete a db.
     * Do nothing and return if db doesn't exist.
     * Return true if the db was existing and is deleted.
     */
    async deleteDb(dbName) {
        try {
            await doCall(this, "DELETE", `/${dbName}`);
            return true;
        }
        catch {
            return false;
        }
    }
    async hasDb(dbName) {
        try {
            await doCall(this, "GET", `/${dbName}`);
            return true;
        }
        catch {
            return false;
        }
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * Return info about this CouchDB instance.
     * See: http://127.0.0.1:5984/_utils/docs/api/server/common.html#api-server-root
     */
    infos() {
        return doCall(this, "GET", "/");
    }
}
export class CouchDB {
    constructor(driver, dbName, url, credentials) {
        this.driver = driver;
        this.dbName = dbName;
        this.credentials = credentials;
        this.url = `${url}/${dbName}`;
    }
    /**
     * Compact the database.
     * CouchDB makes it automatically, but we can force it manually sometimes.
     */
    compact() {
        return doCall(this, "POST", "/_compact");
    }
    doCall(method, urlPath = "", params) {
        return doCall(this, method, urlPath, params);
    }
    // noinspection JSUnusedGlobalSymbols
    all_docs(params) {
        // http://127.0.0.1:5984/_utils/docs/intro/api.html#documents
        return doCall(this, "GET", "/_all_docs", { params });
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a document.
     * See: http://127.0.0.1:5984/_utils/docs/api/document/common.html#get--db-docid
     */
    async loadDoc(docId, params) {
        try {
            return await doCall(this, "GET", `/${docId}`, { params });
        }
        catch (e) {
            if (isNotFoundError(e))
                return undefined;
            throw e;
        }
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * Create or update a document a new document.
     * See : http://127.0.0.1:5984/_utils/docs/api/document/common.html#put--db-docid
     */
    async saveDoc(doc, replaceOnConflict = true) {
        let docId = doc._id;
        if (!docId)
            doc._id = docId = generateUid();
        if (!replaceOnConflict) {
            return await doCall(this, "PUT", `/${docId}`, { body: doc });
        }
        try {
            return await doCall(this, "PUT", `/${docId}`, { body: doc });
        }
        catch (e) {
            if (!isConflictError(e))
                throw e;
            // Cross-racing occurs when:
            // - The same request is asked two-times at the same time by the same emitter.
            // - Processing the doc take time.
            //
            const waitTime = Math.trunc(1000 * Math.random());
            await tick(waitTime);
            const oldDoc = await this.loadDoc(doc._id);
            if (oldDoc) {
                doc._rev = oldDoc._rev;
            }
            else {
                doc._rev = undefined;
            }
            try {
                return await doCall(this, "PUT", `/${docId}`, { body: doc });
            }
            catch (e) {
                if (e instanceof Error)
                    console.error("CouchDB: cross racing occurred", e.stack);
                else
                    console.error("CouchDB: cross racing occurred");
                return { ok: false, id: doc._id, rev: doc._rev };
            }
        }
    }
    /**
     * Delete a group of document in a single operation.
     * See: https://docs.couchdb.org/en/stable/api/database/bulk-api.html#post--db-_bulk_docs
     */
    bulkDeleteDocs(toDelete) {
        const list = toDelete.map(e => ({ _id: e._id, _rev: e._rev, _deleted: true }));
        return doCall(this, "POST", "/_bulk_docs", { body: { docs: list } });
    }
    deleteDoc(docId, rev) {
        return doCall(this, "DELETE", `/${docId}`, { params: { rev } });
    }
    async addAttachmentFromFile(docId, rev, attachmentName, filePath, params) {
        params = params || {};
        if (!params.contentType) {
            params.contentType = NodeSpace.fs.getMimeTypeFromName(filePath);
        }
        const r = NodeSpace.fs.createResponseFromFile(filePath);
        return this.addAttachmentFromStream(docId, rev, attachmentName, r.body, params);
    }
    addAttachmentFromStream(docId, rev, attachmentName, stream, params) {
        const headers = {};
        params = params || {};
        headers["Content-Type"] = params.contentType || "application/octet-stream";
        return doCall(this, "PUT", `/${docId}/${attachmentName}`, { params: { rev }, body: stream, headers });
    }
    createRequestForAttachment(docId, attachmentName) {
        const url = this.url + `/${docId}/${attachmentName}`;
        return fetch(url, { headers: { "Authorization": this.credentials } });
    }
    deleteAttachment(docId, rev, attachmentName) {
        return doCall(this, "DELETE", `/${docId}/${attachmentName}`, { params: { rev } });
    }
    loadDesignDoc(docName) {
        return doCall(this, "GET", `/_design/${docName}`);
    }
    compileDesignDoc(designDocName, params) {
        const designDoc = {
            _id: `_design/${designDocName}`,
            language: "javascript"
        };
        if (params.mapViews) {
            if (!designDoc.views)
                designDoc.views = {};
            for (const viewName in params.mapViews) {
                if (!designDoc.views[viewName])
                    designDoc.views[viewName] = {};
                const f = params.mapViews[viewName];
                designDoc.views[viewName].map = f instanceof Function ? f.toString() : f;
            }
        }
        if (params.reduceViews) {
            if (!designDoc.views)
                designDoc.views = {};
            for (const viewName in params.reduceViews) {
                if (!designDoc.views[viewName])
                    designDoc.views[viewName] = {};
                const f = params.reduceViews[viewName];
                designDoc.views[viewName].reduce = f instanceof Function ? f.toString() : f;
            }
        }
        return designDoc;
    }
    /**
     * Return the view content.
     * See: http://127.0.0.1:5984/_utils/docs/api/ddoc/views.html#db-design-ddoc-view-view
     */
    queryView(designDocName, viewName, params) {
        let newParams = {};
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                if (v != undefined)
                    newParams[k] = v;
            }
            if (params.key)
                newParams.key = JSON.stringify(params.key);
            if (params.keys)
                newParams.keys = JSON.stringify(params.keys);
            if (params.start_key)
                newParams.start_key = JSON.stringify(params.start_key);
            if (params.end_key)
                newParams.end_key = JSON.stringify(params.end_key);
            // Avoid difficulties if there is a reduce function
            // since "reduce=true" is the CouchDB default if there is a reducer.
            if (params.reduce === undefined)
                newParams.reduce = false;
        }
        else {
            newParams.reduce = false;
        }
        return doCall(this, "GET", `/_design/${designDocName}/_view/${viewName}`, { params: newParams });
    }
}
export function generateUid() {
    return crypto.randomUUID();
}
export function emit(_key, _value) {
}
export function isConflictError(error) {
    return error.status === 409;
}
export function isNotFoundError(error) {
    return error.status === 404;
}
/**
 * The last character of the Unicode range.
 * Allow limiting keys.
 */
export const UNICODE_END = "\ufff0";
//# sourceMappingURL=index.js.map