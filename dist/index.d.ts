import "jopi-node-space";
interface WithUrlAndCredential {
    url: string;
    credentials: string;
}
export interface IdRev {
    _id: string;
    _rev: string;
    [key: string]: any;
}
export interface ListParams {
    limit?: number;
    skip?: number;
    descending?: boolean;
}
export interface QueryParams {
    limit?: number;
    skip?: number;
    descending?: boolean;
    key?: any;
    keys?: any[];
    start_key?: any;
    end_key?: any;
    include_docs?: boolean;
    sorted?: boolean;
    /**
     * Returns the "reduce" value.
     * Is generally used with "group=true".
     * Default is false.
     */
    reduce?: boolean;
    /**
     * Is used with "reduce" value.
     * If true: do the reduction for each key.
     * If false: do the reduction for all documents, without regrouping by key.
     */
    group?: boolean;
}
export interface DocumentRef {
    /**
     * The id of the document used to generared this view row.
     */
    id: string;
    /**
     * The document, if load_document is set to true.
     */
    doc?: Document;
    /**
     * The key set by the emit function when building the view.
     */
    key: string;
    /**
     * The value set by the emit function when building the view.
     */
    value: any;
}
export interface NewDocument {
    [key: string]: any;
}
export interface Document {
    _id: string;
    _rev: string;
    _deleted?: boolean;
    _attachments?: any;
    [key: string]: any;
}
export interface ConfirmIdRev {
    ok: boolean;
    id: string;
    rev: string;
}
export interface AddAttachmentParams {
    contentType?: string;
}
export interface RequestViewResponse {
    total_rows: number;
    offset: number;
    rows: DocumentRef[];
}
export interface LoadDocParams {
    attachments?: boolean;
    att_encoding_info?: boolean;
    rev?: boolean;
}
export interface SaveDocResult {
    ok: boolean;
    id: string;
    rev: string;
}
export interface DoCallParams {
    params?: any;
    body?: any | ReadableStream;
    headers?: any;
    debug?: boolean;
}
export interface DesignDoc {
    _id: string;
    language?: "javascript";
    views?: {
        [viewName: string]: DesignDocView;
    };
}
export interface CompileDesignDocParams {
    mapViews?: {
        [viewName: string]: (string | ((doc: any) => void));
    };
    reduceViews?: {
        [viewName: string]: (string | ((keys: any, values: any, rereduce: any) => any));
    };
}
export interface DesignDocView {
    map?: string;
    reduce?: string;
}
export declare class CouchDbError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly request: string;
    readonly errorBody: string;
    constructor(message: string, status: number, statusText: string, request: string, errorBody: string);
}
export declare function doCall(self: WithUrlAndCredential, method: string, urlPath: string, params?: DoCallParams): Promise<unknown>;
export declare class CouchDriver implements WithUrlAndCredential {
    readonly url: string;
    readonly credentials: string;
    constructor(url: string, login: string, password: string);
    getDb(dbName: string): CouchDB;
    /**
     * List all the databases.
     * See: http://127.0.0.1:5984/_utils/docs/api/server/common.html#all-dbs
     */
    listAllDb(params: ListParams): Promise<string>;
    /**
     * Create a new db.
     * Do nothing if db already exists.
     */
    createDb(dbName: string): Promise<CouchDB>;
    /**
     * Delete a db.
     * Do nothing and return if db doesn't exist.
     * Return true if the db was existing and is deleted.
     */
    deleteDb(dbName: string): Promise<boolean>;
    hasDb(dbName: string): Promise<boolean>;
    /**
     * Return info about this CouchDB instance.
     * See: http://127.0.0.1:5984/_utils/docs/api/server/common.html#api-server-root
     */
    infos(): Promise<any>;
}
export declare class CouchDB implements WithUrlAndCredential {
    readonly driver: CouchDriver;
    readonly dbName: string;
    readonly credentials: string;
    readonly url: string;
    constructor(driver: CouchDriver, dbName: string, url: string, credentials: string);
    /**
     * Compact the database.
     * CouchDB makes it automatically, but we can force it manually sometimes.
     */
    compact(): Promise<unknown>;
    doCall<T>(method: string, urlPath?: string, params?: DoCallParams): Promise<T>;
    all_docs(params?: ListParams): Promise<RequestViewResponse>;
    /**
     * Get a document.
     * See: http://127.0.0.1:5984/_utils/docs/api/document/common.html#get--db-docid
     */
    loadDoc(docId: string, params?: LoadDocParams): Promise<Document | undefined>;
    /**
     * Create or update a document a new document.
     * See : http://127.0.0.1:5984/_utils/docs/api/document/common.html#put--db-docid
     */
    saveDoc(doc: NewDocument | Document, replaceOnConflict?: boolean): Promise<SaveDocResult>;
    /**
     * Delete a group of document in a single operation.
     * See: https://docs.couchdb.org/en/stable/api/database/bulk-api.html#post--db-_bulk_docs
     */
    bulkDeleteDocs(toDelete: IdRev[]): Promise<unknown>;
    deleteDoc(docId: string, rev: string): Promise<SaveDocResult>;
    addAttachmentFromFile(docId: string, rev: string, attachmentName: string, filePath: string, params?: AddAttachmentParams): Promise<ConfirmIdRev>;
    addAttachmentFromStream(docId: string, rev: string, attachmentName: string, stream: ReadableStream, params?: AddAttachmentParams): Promise<ConfirmIdRev>;
    createRequestForAttachment(docId: string, attachmentName: string): Promise<Response>;
    deleteAttachment(docId: string, rev: string, attachmentName: string): Promise<ConfirmIdRev>;
    loadDesignDoc(docName: string): Promise<Document>;
    compileDesignDoc(designDocName: string, params: CompileDesignDocParams): NewDocument;
    /**
     * Return the view content.
     * See: http://127.0.0.1:5984/_utils/docs/api/ddoc/views.html#db-design-ddoc-view-view
     */
    queryView(designDocName: string, viewName: string, params?: QueryParams): Promise<RequestViewResponse>;
}
export declare function generateUid(): string;
export declare function emit(_key?: string, _value?: any): void;
export declare function isConflictError(error: any): boolean;
export declare function isNotFoundError(error: any): boolean;
/**
 * The last character of the Unicode range.
 * Allow limiting keys.
 */
export declare const UNICODE_END = "\uFFF0";
export {};
