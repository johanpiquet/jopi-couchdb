import {CouchDriver, emit} from "./index.ts";
import * as path from "node:path";
import "jopi-node-space";

const COUCHDB_URL = "http://127.0.0.1:5984";
const DB_NAME = "test-driver";
const USERNAME = "admin";
const PASSWORD = "couchdb";

const driver = new CouchDriver(COUCHDB_URL, USERNAME, PASSWORD);
const db = driver.getDb(DB_NAME);

const TEST_ALL = false;

async function test(title: string, fn: () => Promise<void>) {
    console.log(title);
    await fn();
}

function assertExists(value: unknown) {
    if (!value) throw new Error("assertExists failed !");
}

if (TEST_ALL) {
    await test("CreateDB", async () => {
        await driver.createDb(DB_NAME);
    });

    await test("DeleteDoc", async function () {
        const newDoc = await db.saveDoc({mustBeDeleted: "yes"});
        assertExists(newDoc);

        console.log(await db.deleteDoc(newDoc.id, newDoc.rev));
    });

    await test("AddAttachment", async function () {
        const filePath = "./src/index.ts";
        const attachmentName = path.basename(filePath);

        const newDoc = await db.saveDoc({test: "AddAttachment"});
        assertExists(newDoc);

        const res = await db.addAttachmentFromFile(newDoc.id, newDoc.rev, attachmentName, filePath, {contentType: "application/x-typescript"});
        newDoc.rev = res.rev;

        //await db.deleteAttachment(newDoc.id, newDoc.rev, attachmentName);
        //console.log(await db.deleteDoc(newDoc.id, newDoc.rev));
    });

    await test("createView", async function () {
        const compiled = db.compileDesignDoc("myDesignDoc", {
            mapViews: {
                "viewA1": (doc) => {
                    emit(doc._id, "ok");
                }
            }
        });

        console.log(await db.saveDoc(compiled, true));
    });

    await test("loadDesignDoc", async function () {
        console.log(await db.loadDesignDoc("myDesignDoc"));
    });
}

await test("queryView", async function() {
    const res = await db.queryView("myDesignDoc", "viewA1", {include_docs: true});
    console.log(res.rows);
});