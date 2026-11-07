// Exact-anchor transform for the version pinned in provenance.json.
function patchGoal(original) {
const oldAction = '\t\t\t\tconst result = await action();\n\t\t\t\tpendingRef.current = false;\n\t\t\t\tsetPending(false);\n\t\t\t\tif (!result.ok) setActionError(`${result.error.message} (${result.error.code})`);\n\t\t\t\treturn result;';
const newAction = '\t\t\t\ttry {\n\t\t\t\t\tconst result = await action();\n\t\t\t\t\tif (!result.ok) setActionError(`${result.error.message} (${result.error.code})`);\n\t\t\t\t\treturn result;\n\t\t\t\t} catch (error) {\n\t\t\t\t\tconst result = { ok: false, error: { code: "goal-action-failed", message: error instanceof Error ? error.message : String(error) } };\n\t\t\t\t\tsetActionError(`${result.error.message} (${result.error.code})`);\n\t\t\t\t\treturn result;\n\t\t\t\t} finally {\n\t\t\t\t\tpendingRef.current = false;\n\t\t\t\t\tsetPending(false);\n\t\t\t\t}';
const oldVisible = '\t\t\tconst showResume = goal.phase === "paused" || goal.phase === "active" && activation === "disarmed";';
const newVisible = '\t\t\tconst showResume = goal.phase === "paused" || goal.phase === "blocked" || goal.phase === "active" && activation === "disarmed";';
for (const old of [oldAction, oldVisible]) if (original.split(old).length !== 2) throw new Error('Original-source mismatch; refusing patch');
const patched = original.replace(oldAction, newAction).replace(oldVisible, newVisible);

return patched;
}
module.exports = { patchGoal };
