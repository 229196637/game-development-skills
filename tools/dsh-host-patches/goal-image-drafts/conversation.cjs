// Exact-anchor transform for the version pinned in provenance.json.
function patchConversation(source) {
let s = source;
function replace(a,b){if(s.split(a).length!==2)throw Error('non-unique patch anchor: '+a.slice(0,100));s=s.replace(a,b);}
const helper=`
		// Persist File/Blob bytes, never blob: URL strings, under the owning Session.
		function openDraftAttachmentDatabase() {
			return new Promise((resolve, reject) => {
				if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable"));
				const request = indexedDB.open("dsh.conversation.attachments", 1);
				request.onupgradeneeded = () => request.result.createObjectStore("sessions");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? new Error("Unable to open attachment drafts"));
				request.onblocked = () => reject(new Error("Attachment draft database is blocked"));
			});
		}
		async function draftAttachmentTransaction(database, mode, operation) {
			const db = await database;
			return new Promise((resolve, reject) => {
				const transaction = db.transaction("sessions", mode);
				const request = operation(transaction.objectStore("sessions"));
				transaction.oncomplete = () => resolve(request?.result);
				transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request?.error ?? new Error("Attachment draft transaction failed"));
			});
		}
`;
replace('\t\t/** Scope-addressed conversation service (root singleton, provided as `conversation`). */',helper+'\t\t/** Scope-addressed conversation service (root singleton, provided as `conversation`). */');
replace('\t\t\tdraftAttachments = /* @__PURE__ */ new Map();','\t\t\tdraftAttachments = /* @__PURE__ */ new Map();\n\t\t\tdraftSessions = new Map();\n\t\t\tdraftDatabase;');
replace('\t\t\t\t\tconst operations = [...this.fileUploadOperations.values()];','\t\t\t\t\tawait Promise.allSettled([...this.draftSessions.values()].map((record) => record.hydration));\n\t\t\t\t\tconst operations = [...this.fileUploadOperations.values()];');
replace('\t\t\t\t\tawait Promise.allSettled([...this.pendingFileUploads]);','\t\t\t\t\tawait Promise.allSettled([...this.pendingFileUploads]);\n\t\t\t\t\tawait Promise.allSettled([...this.draftSessions.values()].map((record) => record.writes));\n\t\t\t\t\tif (this.draftDatabase !== void 0) await this.draftDatabase.then((db) => db.close?.(), () => {});');
const methods=`
			/** Attachment ownership outlives a retained Session scope; disk writes are ordered per Session. */
			bindDraftAttachments(sessionId, shell) {
				let record = this.draftSessions.get(sessionId);
				if (record === void 0) {
					record = { ids: [], loaded: false, listeners: new Set(), writes: Promise.resolve(), error: void 0 };
					this.draftSessions.set(sessionId, record);
					this.draftDatabase ??= openDraftAttachmentDatabase();
					record.hydration = draftAttachmentTransaction(this.draftDatabase, "readonly", (store) => store.get(sessionId)).then((saved) => {
						const restored = [];
						for (const value of Array.isArray(saved) ? saved : []) {
							if (typeof value?.id !== "string" || !["image", "file"].includes(value.kind) || typeof value.file?.arrayBuffer !== "function") continue;
							if (!this.draftAttachments.has(value.id)) {
								// Structured cloning can yield a Blob on older engines; restore the original name.
								const file = typeof value.file.name === "string" ? value.file : new File([value.file], value.name ?? "", { type: value.file.type, lastModified: value.lastModified ?? 0 });
								const attachment = { id: value.id, kind: value.kind, file, sessionId };
								if (value.kind === "image") {
									attachment.previewUrl = URL.createObjectURL(file);
									probeDimensions(attachment);
								}
								this.draftAttachments.set(value.id, attachment);
								// Receipts are Host-Session-owned and may expire after Host restart; cold restore re-stages bytes.
								if (value.kind === "file") this.beginFileUpload(sessionId, attachment);
							}
							restored.push(value.id);
						}
						record.ids = [...new Set([...restored, ...record.ids])];
					}).catch((error) => { record.error = error; }).then(() => {
						record.loaded = true;
						for (const listener of record.listeners) listener();
						this.persistDraftSession(sessionId);
					});
				}
				let warned = false;
				const restore = () => {
					const current = new Set(shell.snapshot.attachmentIds);
					const missing = record.ids.filter((id) => !current.has(id) && this.draftAttachments.has(id));
					if (missing.length > 0) shell.restorePersistedAttachments(record.ids.filter((id) => this.draftAttachments.has(id)));
					if (record.error !== void 0 && !warned) {
						warned = true;
						shell.notify("error", "Attachment drafts could not be saved to browser storage: " + String(record.error.message ?? record.error));
					}
				};
				// Restore cached IDs synchronously before subscribing, including a scope recreated during an IDB read.
				restore();
				record.listeners.add(restore);
				let previousIds = [...shell.snapshot.attachmentIds];
				const sync = () => {
					const ids = shell.snapshot.attachmentIds;
					const removed = new Set(previousIds.filter((id) => !ids.includes(id)));
					previousIds = [...ids];
					const next = [...record.ids.filter((id) => !removed.has(id)), ...ids.filter((id) => !record.ids.includes(id))];
					if (next.length === record.ids.length && next.every((id, i) => id === record.ids[i])) { restore(); return; }
					record.ids = next;
					for (const id of ids) {
						const attachment = this.draftAttachments.get(id);
						if (attachment !== void 0) attachment.sessionId = sessionId;
					}
					this.persistDraftSession(sessionId);
					restore();
				};
				const unsubscribe = shell.state.subscribe(sync);
				sync();
				return () => { unsubscribe(); record.listeners.delete(restore); };
			}
			persistDraftSession(sessionId) {
				const record = this.draftSessions.get(sessionId);
				if (!record?.loaded || record.error !== void 0) return;
				const uploads = this.fileUploads.getSnapshot();
				const saved = this.resolveDraftAttachments(record.ids).map((attachment) => ({
					id: attachment.id, kind: attachment.kind, file: attachment.file,
					name: attachment.file.name, lastModified: attachment.file.lastModified,
					...(attachment.kind === "file" && uploads[attachment.id]?.status === "ready" ? { upload: uploads[attachment.id] } : {})
				}));
				record.writes = record.writes.then(() => draftAttachmentTransaction(this.draftDatabase, "readwrite", (store) => saved.length === 0 ? store.delete(sessionId) : store.put(saved, sessionId))).catch((error) => {
					record.error = error;
					for (const listener of record.listeners) listener();
				});
			}
`;
replace('\t\t\tasync send(text) {',methods+'\n\t\t\tasync send(text) {');
replace('\t\t\t\t\t\tconst attachment = browserDraftAttachment(file);','\t\t\t\t\t\tconst attachment = browserDraftAttachment(file);\n\t\t\t\t\t\tattachment.sessionId = sessionId;');
replace('\t\t\t\t\t\tid: randomUUID(),\n\t\t\t\t\t\tfile','\t\t\t\t\t\tid: randomUUID(),\n\t\t\t\t\t\tsessionId,\n\t\t\t\t\t\tfile');
replace('\t\t\t\t\tif (attachment?.kind === "file") this.beginFileUpload(sessionId, attachment);','\t\t\t\t\tif (attachment !== void 0) attachment.sessionId = sessionId;\n\t\t\t\t\tif (attachment?.kind === "file") this.beginFileUpload(sessionId, attachment);');
replace('\t\t\t\t\t\tif (this.fileUploadOperations.get(attachment.id)?.controller === controller) this.fileUploadOperations.delete(attachment.id);','\t\t\t\t\t\tif (this.fileUploadOperations.get(attachment.id)?.controller === controller) {\n\t\t\t\t\t\t\tthis.fileUploadOperations.delete(attachment.id);\n\t\t\t\t\t\t\tthis.persistDraftSession(attachment.sessionId);\n\t\t\t\t\t\t}');
replace('\t\t\t\tthis.shells.set(binding, shell);','\t\t\t\tthis.shells.set(binding, shell);\n\t\t\t\tlet releaseDraftBinding = () => {};');
replace('\t\t\t\t\t\tconst drafts = shell.dispose();','\t\t\t\t\t\tconst retainedDrafts = new Set(shell.snapshot.attachmentIds);\n\t\t\t\t\t\treleaseDraftBinding();\n\t\t\t\t\t\tconst drafts = shell.dispose();');
replace('\t\t\t\t\t\tfor (const attachmentId of drafts) conversation?.releaseDraftAttachment(attachmentId);','\t\t\t\t\t\tfor (const attachmentId of drafts) if (!retainedDrafts.has(attachmentId)) conversation?.releaseDraftAttachment(attachmentId);');
replace('\t\t\t\tshell.setDraft(readConversationDraft(binding.sessionId));',`\t\t\t\tshell.setDraft(readConversationDraft(binding.sessionId));
\t\t\t\tactx.inject(["conversation"], (scope) => {
\t\t\t\t\tscope.effect(() => {
\t\t\t\t\t\tconst release = this.conversation().bindDraftAttachments(binding.sessionId, shell);
\t\t\t\t\t\treleaseDraftBinding = release;
\t\t\t\t\t\treturn release;
\t\t\t\t\t}, "conversation.input: attachment persistence");
\t\t\t\t});`);
replace('\t\t\t/** Append ordered attachment ids unless an admission transaction is locked. */',`\t\t\t/** Restore durable IDs before newly added attachments, without changing a locked admission. */
\t\t\trestorePersistedAttachments(ids) {
\t\t\t\tif (this.disposed || this.snapshot.phase === "adjudicating" || this.snapshot.phase === "submitting") return false;
\t\t\t\tthis.attachmentIds = [...new Set([...ids, ...this.attachmentIds])];
\t\t\t\tthis.publish();
\t\t\t\treturn true;
\t\t\t}
\t\t\t/** Append ordered attachment ids unless an admission transaction is locked. */`);

return s;
}
module.exports = { patchConversation };
