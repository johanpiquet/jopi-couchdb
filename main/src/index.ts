// noinspection JSUnusedGlobalSymbols

import "jopi-node-space";

const tick = NodeSpace.timer.tick;

//region Interfaces

interface WithUrlAndCredential {
  url: string;
  credentials: string;
}

export interface IdRev {
  _id: string;
  _rev: string;

  // Any value.
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
}

export interface DocumentRef {
  /**
   * The id of the document used to generared this view row.
   */
  id: string,

  /**
   * The document, if load_document is set to true.
   */
  doc?: Document

  /**
   * The key set by the emit function when building the view.
   */
  key: string,

  /**
   * The value set by the emit function when building the view.
   */
  value: any
}

export interface NewDocument {
  // Any value.
  [key: string]: any;
}

export interface Document {
  _id: string;
  _rev: string;

  _deleted?: boolean;
  _attachments?: any;

  // Any value.
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
  rows: DocumentRef[]
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
  body?: any|ReadableStream;
  headers?: any;
  debug?: boolean;
}

export interface DesignDoc {
  _id: string;
  language?: "javascript";
  views?: {[viewName: string]: DesignDocView};
}

export interface CompileDesignDocParams {
  mapViews?: {[viewName: string]: (string|((doc:any)=>void))};
  reduceViews?: {[viewName: string]: (string|((keys: any, values: any, rereduce: any)=>any))};
}

export interface DesignDocView {
  map?: string;
  reduce?: string;
}

//endregion

export class CouchDbError extends Error {
  // noinspection JSUnusedGlobalSymbols
  constructor(message: string,
              public readonly status: number,
              public readonly statusText: string,
              public readonly request: string,
              public readonly errorBody: string) {
    super(message);
  }
}

export async function doCall(self: WithUrlAndCredential, method: string, urlPath: string, params?: DoCallParams): Promise<unknown> {
  // Allow knowing the call-stack.
  //const errorStack = new Error().stack;

  params = params || {};

  if (params.params) {
    const searchParams = new URLSearchParams();

    for (const [k, v] of Object.entries(params.params)) {
      if (Array.isArray(v)) {
        v.forEach(item => {
          searchParams.append(k, String(item))
        });
      } else if (typeof v === 'object') {
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

  if (isJson) headers["Content-Type"] = "application/json";

  if (params.debug) {
    console.log(`Fetching ${self.url + urlPath} with params`, {method, body: params.body, headers});
    debugger;
  }

  let response: Response;

  try {
    response = await fetch(self.url + urlPath, {method, body: body, headers});
  } catch(e: any) {
      console.error(e);
      console.error("CouchDB Server not connected !");
      throw new Error("CouchDB Server not connected !");
  }

  if (!response.ok) {
    //if (response.status === 409) {console.log(errorStack); debugger; }

    throw new CouchDbError(
        `CouchDB - ${response.status} - ${response.statusText}`,
        response.status,
        response.statusText,
        method + "|" + urlPath,
        await response.text()
    );
  }

  return response.json();
}

export class CouchDriver implements WithUrlAndCredential {
  public readonly url: string;
  public readonly credentials: string;

  constructor(url: string, login: string, password: string) {
    this.url = url;
    this.credentials = "Basic " + btoa(`${login}:${password}`);
  }

  getDb(dbName: string): CouchDB {
    return new CouchDB(this, dbName, this.url, this.credentials)
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * List all the databases.
   * See: http://127.0.0.1:5984/_utils/docs/api/server/common.html#all-dbs
   */
  listAllDb(params: ListParams): Promise<string> {
    return doCall(this, "GET", "/_all_dbs", {params}) as Promise<string>;
  }

  /**
   * Create a new db.
   * Do nothing if db already exists.
   */
  async createDb(dbName: string): Promise<CouchDB> {
    try {
      await doCall(this, "PUT", `/${dbName}`);
    } catch (e: any) {
      if (e.status === 400) throw "Illegal database name."
    }

    return this.getDb(dbName);
  }

  /**
   * Delete a db.
   * Do nothing and return if db doesn't exist.
   * Return true if the db was existing and is deleted.
   */
  async deleteDb(dbName: string): Promise<boolean> {
    try {
        await doCall(this, "DELETE", `/${dbName}`);
        return true;
    }
    catch {
      return false;
    }
  }

  async hasDb(dbName: string): Promise<boolean> {
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
    return doCall(this, "GET", "/") as Promise<any>;
  }
}

export class CouchDB implements WithUrlAndCredential {
  public readonly url: string;

  constructor(public readonly driver: CouchDriver, public readonly dbName: string, url: string, public readonly credentials: string) {
    this.url = `${url}/${dbName}`;
  }

  /**
   * Compact the database.
   * CouchDB makes it automatically, but we can force it manually sometimes.
   */
  compact() {
    return doCall(this, "POST", "/_compact");
  }

  doCall<T>(method: string, urlPath: string = "", params?: DoCallParams): Promise<T> {
    return doCall(this, method, urlPath, params) as Promise<T>;
  }

  // noinspection JSUnusedGlobalSymbols
  all_docs(params?: ListParams): Promise<RequestViewResponse> {
    // http://127.0.0.1:5984/_utils/docs/intro/api.html#documents
    return doCall(this, "GET", "/_all_docs", {params}) as Promise<RequestViewResponse>;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get a document.
   * See: http://127.0.0.1:5984/_utils/docs/api/document/common.html#get--db-docid
   */
  async loadDoc(docId: string, params?: LoadDocParams): Promise<Document|undefined> {
    try {
      return await doCall(this, "GET", `/${docId}`, {params}) as Promise<Document>;
    }
    catch(e) {
      if (isNotFoundError(e)) return undefined;
      throw e;
    }
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Create or update a document a new document.
   * See : http://127.0.0.1:5984/_utils/docs/api/document/common.html#put--db-docid
   */
  async saveDoc(doc: NewDocument|Document, replaceOnConflict = true): Promise<SaveDocResult> {
    let docId = doc._id;
    if (!docId) doc._id = docId = generateUid();

    if (!replaceOnConflict) {
      return await doCall(this, "PUT", `/${docId}`, {body: doc}) as Promise<SaveDocResult>;
    }

    try {
      return await doCall(this, "PUT", `/${docId}`, {body: doc}) as Promise<SaveDocResult>;
    }
    catch (e) {
      if (!isConflictError(e)) throw e;

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
        return await doCall(this, "PUT", `/${docId}`, {body: doc}) as Promise<SaveDocResult>;
      }
      catch(e) {
        if (e instanceof Error) console.error("CouchDB: cross racing occurred", e.stack);
        else console.error("CouchDB: cross racing occurred");

        return {ok:false, id: doc._id, rev: doc._rev};
      }
    }
  }

  /**
   * Delete a group of document in a single operation.
   * See: https://docs.couchdb.org/en/stable/api/database/bulk-api.html#post--db-_bulk_docs
   */
  bulkDeleteDocs(toDelete: IdRev[]) {
    const list = toDelete.map(e => ({_id: e._id, _rev: e._rev, _deleted: true}));
    return doCall(this, "POST", "/_bulk_docs", {body: {docs: list}});
  }

  deleteDoc(docId: string, rev: string): Promise<SaveDocResult> {
    return doCall(this, "DELETE", `/${docId}`, {params: {rev}}) as Promise<SaveDocResult>;
  }

  async addAttachmentFromFile(docId: string, rev: string, attachmentName: string, filePath: string, params?: AddAttachmentParams): Promise<ConfirmIdRev> {
    params = params||{};

    if (!params.contentType) {
      params.contentType = NodeSpace.fs.getMimeTypeFromName(filePath);
    }

    const r = NodeSpace.fs.createResponseFromFile(filePath);
    return this.addAttachmentFromStream(docId, rev, attachmentName, r.body!, params);
  }

  addAttachmentFromStream(docId: string, rev: string, attachmentName: string, stream: ReadableStream, params?: AddAttachmentParams): Promise<ConfirmIdRev>{
    const headers: any = {};

    params = params || {};
    headers["Content-Type"] = params.contentType || "application/octet-stream";
    return doCall(this, "PUT", `/${docId}/${attachmentName}`, {params: {rev}, body: stream, headers}) as Promise<ConfirmIdRev>;
  }

  createRequestForAttachment(docId: string, attachmentName: string): Promise<Response> {
      const url = this.url + `/${docId}/${attachmentName}`;
      return fetch(url, {headers: {"Authorization": this.credentials}});
  }

  deleteAttachment(docId: string, rev: string, attachmentName: string): Promise<ConfirmIdRev> {
    return doCall(this, "DELETE", `/${docId}/${attachmentName}`, {params: {rev}}) as Promise<ConfirmIdRev>;
  }

  loadDesignDoc(docName: string): Promise<Document> {
    return doCall(this, "GET", `/_design/${docName}`) as Promise<Document>;
  }

  compileDesignDoc(designDocName: string, params: CompileDesignDocParams): NewDocument {
    const designDoc: DesignDoc = {
      _id: `_design/${designDocName}`,
      language: "javascript"
    };

    if (params.mapViews) {
      if (!designDoc.views) designDoc.views = {};

      for (const viewName in params.mapViews) {
        if (!designDoc.views[viewName]) designDoc.views[viewName] = {};
        const f = params.mapViews[viewName];
        designDoc.views[viewName].map = f instanceof Function ? f.toString() : f;
      }
    }

    if (params.reduceViews) {
        if (!designDoc.views) designDoc.views = {};

        for (const viewName in params.reduceViews) {
            if (!designDoc.views[viewName]) designDoc.views[viewName] = {};
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
  queryView(designDocName: string, viewName: string, params?: QueryParams): Promise<RequestViewResponse> {
    let newParams: any = undefined;

    if (params) {
      newParams = {};

      for (const [k,v] of Object.entries(params)) {
        if (v!=undefined) newParams[k] = v;
      }

      if (params.key) newParams.key = JSON.stringify(params.key);
      if (params.keys) newParams.keys = JSON.stringify(params.keys);
      if (params.start_key) newParams.start_key = JSON.stringify(params.start_key);
      if (params.end_key) newParams.end_key = JSON.stringify(params.end_key);
    }

    return doCall(this, "GET", `/_design/${designDocName}/_view/${viewName}`, {params: newParams}) as Promise<RequestViewResponse>;
  }
}

export function generateUid(): string {
  return crypto.randomUUID()
}

export function emit(_key?: string, _value?: any) {
}

export function isConflictError(error: any): boolean {
  return error.status===409;
}

export function isNotFoundError(error: any) {
  return error.status===404;
}