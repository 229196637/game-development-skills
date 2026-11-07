// Prepare a patched ASAR preserving all original entries and payload bytes.
// Never installs or restarts the application. Usage: node prepare-archive.cjs manifest.json
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const archive=manifest.archive, output=manifest.output;
if(fs.existsSync(output))throw Error('Refusing overwrite: '+output);
const input=fs.openSync(archive,'r');const prefix=Buffer.alloc(16);fs.readSync(input,prefix,0,16,0);
const header=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(input,header,0,header.length,16);const tree=JSON.parse(header.toString('utf8'));
const oldDataStart=8+prefix.readUInt32LE(4),originalSize=fs.fstatSync(input).size;
let tailOffset=originalSize-oldDataStart;const additions=[],changes=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const patch of manifest.patches){let entry=tree;for(const part of patch.entry.split('/')){entry=entry.files?.[part];if(!entry)throw Error('Missing archive entry '+patch.entry);}
if(entry.unpacked||entry.files||entry.link)throw Error('Not a packed regular file '+patch.entry);
const before=Buffer.alloc(Number(entry.size));fs.readSync(input,before,0,before.length,oldDataStart+Number(entry.offset));
if(sha(before)!==patch.originalSha256)throw Error('Original hash mismatch '+patch.entry);
const bytes=fs.readFileSync(patch.file);const blocks=[],blockSize=entry.integrity?.blockSize||4194304;
for(let offset=0;offset<bytes.length;offset+=blockSize)blocks.push(sha(bytes.subarray(offset,offset+blockSize)));
entry.offset=String(tailOffset);entry.size=bytes.length;entry.integrity={algorithm:'SHA256',hash:sha(bytes),blockSize,blocks};
additions.push(bytes);tailOffset+=bytes.length;changes.push({entry:patch.entry,before:sha(before),after:sha(bytes),size:bytes.length});}
const json=Buffer.from(JSON.stringify(tree));const payloadSize=Math.ceil((4+json.length)/4)*4;const pickle=Buffer.alloc(4+payloadSize);pickle.writeUInt32LE(payloadSize,0);pickle.writeUInt32LE(json.length,4);json.copy(pickle,8);const outer=Buffer.alloc(8);outer.writeUInt32LE(4,0);outer.writeUInt32LE(pickle.length,4);
fs.mkdirSync(path.dirname(output),{recursive:true});const out=fs.openSync(output,'wx');fs.writeSync(out,outer);fs.writeSync(out,pickle);
const buffer=Buffer.alloc(4*1024*1024);let position=oldDataStart;while(position<originalSize){const n=fs.readSync(input,buffer,0,Math.min(buffer.length,originalSize-position),position);if(!n)throw Error('Unexpected EOF');fs.writeSync(out,buffer,0,n);position+=n;}
for(const bytes of additions)fs.writeSync(out,bytes);fs.closeSync(out);fs.closeSync(input);
const verify=fs.openSync(output,'r');const dataStart=8+pickle.length;
for(const change of changes){let entry=tree;for(const part of change.entry.split('/'))entry=entry.files[part];const b=Buffer.alloc(entry.size);fs.readSync(verify,b,0,b.length,dataStart+Number(entry.offset));if(sha(b)!==change.after)throw Error('Output verification failed '+change.entry);}
fs.closeSync(verify);console.log(JSON.stringify({output,originalSize,outputSize:fs.statSync(output).size,changes},null,2));
